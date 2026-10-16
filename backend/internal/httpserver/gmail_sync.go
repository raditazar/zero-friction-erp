package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"google.golang.org/api/idtoken"
	"zero-friction-erp/backend/internal/gmail"
)

type gmailTransactor interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}
type gmailSyncResult struct {
	Imported int  `json:"imported"`
	Failed   int  `json:"failed"`
	Ignored  int  `json:"ignored"`
	More     bool `json:"more"`
}

func (s *Server) gmailRecord(ctx context.Context, c gmailConnection, lease, id, status, code string, received *time.Time, receipt *gmail.Receipt) (string, error) {
	beginner, ok := s.db.(gmailTransactor)
	if !ok {
		return "", errors.New("transactional_database_required")
	}
	tx, err := beginner.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", err
	}
	defer func() {
		rollbackCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
		defer cancel()
		_ = tx.Rollback(rollbackCtx)
	}()
	var owner string
	err = tx.QueryRow(ctx, `select user_id::text from gmail_connections where id=$1 and lease_id=$2 and lease_until>now() for update`, c.ID, lease).Scan(&owner)
	if err != nil || owner != c.UserID {
		return "", errors.New("lease_lost")
	}
	var transactionID *string
	var previous string
	err = tx.QueryRow(ctx, `select status,transaction_id::text from gmail_messages where connection_id=$1 and message_id=$2`, c.ID, id).Scan(&previous, &transactionID)
	if err == nil && previous == "imported" {
		return "duplicate", nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if receipt != nil {
		// Monetary value goes to PostgreSQL numeric as a decimal string, never float.
		// Owner/wallet validation is inside the transaction; no credential or account
		// number is copied into transactions.raw_input.
		note := receipt.Note
		if note == "" {
			note = "CIMB Incoming BI FAST — " + receipt.SenderBank
		}
		if c.TestMode {
			note = "UJI ERP — " + note
		}
		if receipt.DateOnly {
			note += "; tanggal tanpa jam"
		}

		merchant := receipt.MerchantOrSender
		if merchant == "" {
			merchant = receipt.SenderName
		}
		if merchant == "" {
			merchant = "Transaksi Email"
		}

		txType := strings.ToLower(receipt.Type)
		if txType != "expense" && txType != "transfer" {
			txType = "income"
		}

		sourceWalletID := c.WalletID
		var destWalletID *string

		if txType == "transfer" {
			if receipt.DestinationWalletHint != "" {
				var targetID string
				hintErr := tx.QueryRow(ctx, `select id::text from wallets where user_id=$1 and deleted_at is null and is_active and (provider_slug=$2 or lower(name) like '%' || lower($2) || '%') order by case when provider_slug=$2 then 0 else 1 end limit 1`, c.UserID, receipt.DestinationWalletHint).Scan(&targetID)
				if hintErr == nil && targetID != "" && targetID != sourceWalletID {
					destWalletID = &targetID
				}
			}
		} else if txType == "expense" && receipt.ProviderSlug != "" && receipt.ProviderSlug != "cimb" {
			var providerWalletID string
			pErr := tx.QueryRow(ctx, `select id::text from wallets where user_id=$1 and deleted_at is null and is_active and (provider_slug=$2 or lower(name) like '%' || lower($2) || '%') order by case when provider_slug=$2 then 0 else 1 end limit 1`, c.UserID, receipt.ProviderSlug).Scan(&providerWalletID)
			if pErr == nil && providerWalletID != "" {
				sourceWalletID = providerWalletID
			}
		}

		err = tx.QueryRow(ctx, `insert into transactions(user_id,wallet_id,destination_wallet_id,type,status,transaction_at,merchant,amount,note,input_source,input_mode) select $1,id,nullif($3,'')::uuid,$4::transaction_type,'needs_review'::transaction_status,$5,$6,$7::numeric,$8,'api','text' from wallets where id=$2 and user_id=$1 and deleted_at is null and is_active and currency='IDR' returning id::text`, c.UserID, sourceWalletID, stringValueOrEmpty(destWalletID), txType, receipt.TransactionAt, merchant, receipt.Amount, note).Scan(&transactionID)
		if err != nil {
			return "", err
		}
	}
	_, err = tx.Exec(ctx, `insert into gmail_messages(connection_id,message_id,status,error_code,transaction_id,received_at) values($1,$2,$3,nullif($4,''),$5,$6) on conflict(connection_id,message_id) do update set status=excluded.status,error_code=excluded.error_code,transaction_id=excluded.transaction_id,received_at=excluded.received_at,processed_at=now()`, c.ID, id, status, code, transactionID, received)
	if err != nil {
		return "", err
	}
	return status, tx.Commit(ctx)
}

func (s *Server) gmailProcess(ctx context.Context, c gmailConnection, client *gmail.Client, lease, id string, explicit bool) (string, error) {
	var previous string
	err := s.db.QueryRow(ctx, `select status from gmail_messages where connection_id=$1 and message_id=$2`, c.ID, id).Scan(&previous)
	if err == nil && (previous == "imported" || !explicit) {
		return "duplicate", nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	m, err := client.Message(ctx, id, "metadata")
	if err != nil {
		var api *gmail.APIError
		if errors.As(err, &api) && api.Status == 404 {
			return s.gmailRecord(ctx, c, lease, id, "ignored", "message_deleted", nil, nil)
		}
		return "", err
	}
	var from, subject string
	for _, h := range m.Payload.Headers {
		if strings.EqualFold(h.Name, "From") {
			from = h.Value
		}
		if strings.EqualFold(h.Name, "Subject") {
			subject = h.Value
		}
	}
	// Metadata is only a prefilter. Parse performs the strict From/subject checks.
	if !gmail.IsCandidate(from, subject) {
		return s.gmailRecord(ctx, c, lease, id, "ignored", "not_financial_email", nil, nil)
	}
	ms, err := strconv.ParseInt(m.InternalDate, 10, 64)
	if err != nil || ms <= 0 {
		return s.gmailRecord(ctx, c, lease, id, "failed", "invalid_received_date", nil, nil)
	}
	received := time.UnixMilli(ms).UTC()
	if !explicit && (c.ActivatedAt == nil || received.Before(*c.ActivatedAt)) {
		return s.gmailRecord(ctx, c, lease, id, "ignored", "before_activation", &received, nil)
	}
	for _, label := range m.LabelIDs {
		if label == "SPAM" || label == "TRASH" {
			return s.gmailRecord(ctx, c, lease, id, "ignored", "spam_or_trash", &received, nil)
		}
	}
	m, err = client.Message(ctx, id, "raw")
	if err != nil {
		return "", err
	}
	raw, err := m.Bytes()
	if err != nil {
		return s.gmailRecord(ctx, c, lease, id, "failed", "invalid_raw_email", &received, nil)
	}
	receipt, err := gmail.Parse(raw, true)
	if err != nil {
		return s.gmailRecord(ctx, c, lease, id, "failed", err.Error(), &received, nil)
	}
	if receipt.RecipientAccount != "" {
		account, err := gmail.Open(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), c.AccountCipher, c.UserID+":account")
		if err != nil {
			return "", err
		}
		if receipt.RecipientAccount != account {
			return s.gmailRecord(ctx, c, lease, id, "failed", "recipient_account_mismatch", &received, nil)
		}
	}
	return s.gmailRecord(ctx, c, lease, id, "imported", "", &received, &receipt)
}

func (s *Server) gmailImport(w http.ResponseWriter, r *http.Request) {
	id := gmailMessageID(w, r)
	if id == "" {
		return
	}
	c, err := s.gmailLoad(r.Context(), userID(r))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	if c.WalletID == "" || c.AccountCipher == "" {
		writeError(w, 409, "configure recipient account and wallet first")
		return
	}
	lease, err := s.gmailLease(r.Context(), c.ID)
	if err != nil {
		writeError(w, 409, "sync in progress; retry")
		return
	}
	defer s.gmailRelease(r.Context(), c.ID, lease)
	c, err = s.gmailLoad(r.Context(), userID(r))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()
	client, err := s.gmailClient(ctx, c)
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	status, err := s.gmailProcess(ctx, c, client, lease, id, true)
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]string{"status": status, "message_id": id})
}

func (s *Server) gmailSync(ctx context.Context, c gmailConnection) (result gmailSyncResult, err error) {
	if !c.Enabled || c.Cipher == "" {
		return result, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	lease, err := s.gmailLease(ctx, c.ID)
	if err != nil {
		return result, err
	}
	defer s.gmailRelease(ctx, c.ID, lease)
	// Re-read after acquiring lease: settings may have changed since trigger load.
	c, err = s.gmailLoad(ctx, c.UserID)
	if err != nil {
		return result, err
	}
	if !c.Enabled {
		return result, nil
	}
	defer func() {
		code := ""
		if err != nil {
			code = "sync_failed"
			var api *gmail.APIError
			if errors.As(err, &api) {
				code = api.Error()
			}
		}
		statusCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
		defer cancel()
		_ = s.db.QueryRow(statusCtx, `update gmail_connections set last_error=nullif($3,''),last_sync_at=case when $3='' then now() else last_sync_at end where id=$1 and lease_id=$2 returning id::text`, c.ID, lease, code).Scan(new(string))
	}()
	client, err := s.gmailClient(ctx, c)
	if err != nil {
		return result, err
	}
	if topic := os.Getenv("GMAIL_PUBSUB_TOPIC"); topic != "" && (c.WatchExpiresAt == nil || c.WatchExpiresAt.Before(time.Now().Add(24*time.Hour))) {
		watch, err := client.Watch(ctx, topic)
		if err != nil {
			return result, err
		}
		ms, err := strconv.ParseInt(watch.Expiration, 10, 64)
		if err != nil || ms <= time.Now().UnixMilli() {
			return result, errors.New("invalid_watch_expiration")
		}
		// Renewing watch must never replace the cursor: that would skip unread changes.
		if err := s.db.QueryRow(ctx, `update gmail_connections set watch_expires_at=$3 where id=$1 and lease_id=$2 returning id::text`, c.ID, lease, time.UnixMilli(ms)).Scan(new(string)); err != nil {
			return result, err
		}
	}
	if c.HistoryID == "" || c.ActivatedAt == nil {
		return result, errors.New("activation_required")
	}
	var ids []string
	next, history, recovery := c.PageToken, c.HistoryID, c.RecoveryID
	if recovery == "" {
		h, e := client.History(ctx, history, next)
		var api *gmail.APIError
		if errors.As(e, &api) && api.Status == 404 {
			p, e := client.Profile(ctx)
			if e != nil {
				return result, e
			}
			if p.HistoryID == "" {
				return result, errors.New("invalid_history_id")
			}
			recovery = p.HistoryID
			next = ""
			if e := s.db.QueryRow(ctx, `update gmail_connections set recovery_history_id=$3,page_token=null where id=$1 and lease_id=$2 returning id::text`, c.ID, lease, recovery).Scan(new(string)); e != nil {
				return result, e
			}
		} else if e != nil {
			if errors.As(e, &api) && api.Status == 400 && next != "" {
				// Expired pagination tokens restart from the saved cursor, with dedup.
				if resetErr := s.db.QueryRow(ctx, `update gmail_connections set page_token=null where id=$1 and lease_id=$2 returning id::text`, c.ID, lease).Scan(new(string)); resetErr != nil {
					return result, resetErr
				}
			}
			return result, e
		} else {
			for _, entry := range h.History {
				for _, added := range entry.Added {
					ids = append(ids, added.Message.ID)
				}
			}
			next = h.NextPageToken
			if next == "" {
				if h.HistoryID == "" {
					return result, errors.New("invalid_history_id")
				}
				history = h.HistoryID
			}
		}
	}
	if recovery != "" {
		list, e := client.Search(ctx, *c.ActivatedAt, next)
		if e != nil {
			var api *gmail.APIError
			if errors.As(e, &api) && api.Status == 400 && next != "" {
				if resetErr := s.db.QueryRow(ctx, `update gmail_connections set page_token=null where id=$1 and lease_id=$2 returning id::text`, c.ID, lease).Scan(new(string)); resetErr != nil {
					return result, resetErr
				}
			}
			return result, e
		}
		for _, m := range list.Messages {
			ids = append(ids, m.ID)
		}
		next = list.NextPageToken
		if next == "" {
			history = recovery
			recovery = ""
		}
	}
	// ponytail: at most ten new messages per request. Persisted message outcomes
	// let the next invocation resume the same page; add a worker if volume grows.
	processed := 0
	for _, id := range ids {
		if processed >= 10 {
			result.More = true
			return result, nil
		}
		status, e := s.gmailProcess(ctx, c, client, lease, id, false)
		if e != nil {
			return result, e
		}
		switch status {
		case "imported":
			result.Imported++
			processed++
		case "failed":
			result.Failed++
			processed++
		case "ignored":
			result.Ignored++
			processed++
		}
	}
	err = s.db.QueryRow(ctx, `update gmail_connections set history_id=$3,page_token=nullif($4,''),recovery_history_id=nullif($5,''),updated_at=now() where id=$1 and lease_id=$2 and lease_until>now() returning id::text`, c.ID, lease, history, next, recovery).Scan(new(string))
	result.More = next != ""
	return result, err
}

func (s *Server) gmailManualSync(w http.ResponseWriter, r *http.Request) {
	c, err := s.gmailLoad(r.Context(), userID(r))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	if !c.Enabled {
		writeError(w, 409, "activate integration first")
		return
	}
	result, err := s.gmailSync(r.Context(), c)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, 409, "sync in progress; retry")
			return
		}
		s.gmailError(w, r, err)
		return
	}
	writeJSON(w, 200, result)
}

func gmailMachineAuth(r *http.Request, audience, serviceAccount string) bool {
	if audience == "" || serviceAccount == "" || bearerToken(r) == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	payload, err := idtoken.Validate(ctx, bearerToken(r), audience)
	if err != nil {
		return false
	}
	if payload.Issuer != "https://accounts.google.com" && payload.Issuer != "accounts.google.com" {
		return false
	}
	return payload.Claims["email"] == serviceAccount && payload.Claims["email_verified"] == true
}

func (s *Server) gmailPush(w http.ResponseWriter, r *http.Request) {
	if !gmailMachineAuth(r, os.Getenv("GMAIL_PUSH_AUDIENCE"), os.Getenv("GMAIL_PUSH_SERVICE_ACCOUNT")) {
		writeError(w, 401, "invalid push identity")
		return
	}
	if s.db == nil {
		writeError(w, 503, "database unavailable")
		return
	}
	var event struct {
		Subscription string `json:"subscription"`
		Message      struct {
			Data string `json:"data"`
			ID   string `json:"messageId"`
		} `json:"message"`
	}
	if !decodeBody(w, r, &event) {
		return
	}
	if os.Getenv("GMAIL_PUBSUB_SUBSCRIPTION") == "" || event.Subscription != os.Getenv("GMAIL_PUBSUB_SUBSCRIPTION") || event.Message.ID == "" {
		writeError(w, 400, "invalid subscription")
		return
	}
	b, err := base64.StdEncoding.DecodeString(event.Message.Data)
	if err != nil {
		writeError(w, 400, "invalid push data")
		return
	}
	var signal struct {
		Email     string `json:"emailAddress"`
		HistoryID string `json:"historyId"`
	}
	if json.Unmarshal(b, &signal) != nil || signal.HistoryID == "" || !strings.EqualFold(signal.Email, os.Getenv("GMAIL_OWNER_EMAIL")) {
		writeError(w, 400, "invalid mailbox signal")
		return
	}
	s.gmailRunOwner(w, r)
}
func (s *Server) gmailMaintenance(w http.ResponseWriter, r *http.Request) {
	if !gmailMachineAuth(r, os.Getenv("GMAIL_MAINTENANCE_AUDIENCE"), os.Getenv("GMAIL_MAINTENANCE_SERVICE_ACCOUNT")) {
		writeError(w, 401, "invalid scheduler identity")
		return
	}
	if s.db == nil {
		writeError(w, 503, "database unavailable")
		return
	}
	s.gmailRunOwner(w, r)
}
func (s *Server) gmailRunOwner(w http.ResponseWriter, r *http.Request) {
	var id string
	err := s.db.QueryRow(r.Context(), `select id::text from users where lower(email)=lower($1)`, os.Getenv("GMAIL_OWNER_EMAIL")).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		w.WriteHeader(204)
		return
	}
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	c, err := s.gmailLoad(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		w.WriteHeader(204)
		return
	}
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	result, err := s.gmailSync(r.Context(), c)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 503, "sync busy; retry")
		return
	}
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	if result.More {
		writeError(w, 503, "more pages; retry")
		return
	}
	if s.logger != nil {
		s.logger.Info("gmail sync", "imported", result.Imported, "failed", result.Failed, "ignored", result.Ignored)
	}
	writeJSON(w, 200, result)
}
