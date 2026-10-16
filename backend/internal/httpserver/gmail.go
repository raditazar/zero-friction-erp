package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"zero-friction-erp/backend/internal/gmail"
)

const gmailScope = "https://www.googleapis.com/auth/gmail.readonly"

type gmailConnection struct {
	ID, UserID, Email, Cipher, WalletID, AccountCipher, HistoryID, PageToken, RecoveryID string
	Enabled, TestMode                                                                    bool
	ActivatedAt, WatchExpiresAt                                                          *time.Time
}

func (s *Server) registerGmail(mux *http.ServeMux) {
	userMux := http.NewServeMux()
	userMux.HandleFunc("GET /integrations/gmail/connect", s.gmailConnect)
	userMux.HandleFunc("GET /integrations/gmail/callback", s.gmailCallback)
	userMux.HandleFunc("GET /integrations/gmail/status", s.gmailStatus)
	userMux.HandleFunc("GET /integrations/gmail/messages", s.gmailCandidates)
	userMux.HandleFunc("PUT /integrations/gmail/settings", s.gmailSettings)
	userMux.HandleFunc("POST /integrations/gmail/preview", s.gmailPreview)
	userMux.HandleFunc("POST /integrations/gmail/import", s.gmailImport)
	userMux.HandleFunc("POST /integrations/gmail/sync", s.gmailManualSync)
	userMux.HandleFunc("DELETE /integrations/gmail/connection", s.gmailDisconnect)
	mux.Handle("/integrations/gmail/", s.gmailUserAuth(userMux))
	mux.HandleFunc("POST /integrations/gmail/push", s.gmailPush)
	mux.HandleFunc("POST /integrations/gmail/maintenance", s.gmailMaintenance)
}

// Explicit credentials are required even in development. Existing auth fallback
// is intentionally not used for this feature.
func (s *Server) gmailUserAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.db == nil {
			writeError(w, 503, "database unavailable")
			return
		}
		var id string
		var err error
		if token := bearerToken(r); strings.HasPrefix(token, "zfe_api_") {
			id, err = s.validateAPIKey(r, token)
		} else if cookie, e := r.Cookie("zfe_session"); e == nil && cookie.Value != "" {
			id, err = s.validateSession(r, cookie.Value)
		} else {
			writeError(w, 401, "valid credential required")
			return
		}
		if err != nil {
			writeError(w, 401, "invalid credential")
			return
		}
		owner := strings.TrimSpace(os.Getenv("GMAIL_OWNER_EMAIL"))
		var email string
		if owner == "" {
			writeError(w, 503, "GMAIL_OWNER_EMAIL is required")
			return
		}
		if err := s.db.QueryRow(r.Context(), "select email from users where id=$1", id).Scan(&email); err != nil || !strings.EqualFold(owner, email) {
			writeError(w, 403, "integration owner required")
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" && r.Header.Get("Origin") != "" {
			origin, e := url.Parse(r.Header.Get("Origin"))
			allowed, e2 := url.Parse(os.Getenv("FRONTEND_URL"))
			if e != nil || e2 != nil || origin.Host == "" || origin.Scheme != allowed.Scheme || origin.Host != allowed.Host {
				writeError(w, 403, "invalid origin")
				return
			}
		}
		next.ServeHTTP(w, withUserID(r, id))
	})
}

func (s *Server) gmailLoad(ctx context.Context, user string) (gmailConnection, error) {
	var c gmailConnection
	err := s.db.QueryRow(ctx, `select id::text,user_id::text,email,coalesce(refresh_token_ciphertext,''),coalesce(wallet_id::text,''),coalesce(recipient_account_ciphertext,''),enabled,test_mode,activated_at,coalesce(history_id,''),coalesce(page_token,''),coalesce(recovery_history_id,''),watch_expires_at from gmail_connections where user_id=$1`, user).Scan(&c.ID, &c.UserID, &c.Email, &c.Cipher, &c.WalletID, &c.AccountCipher, &c.Enabled, &c.TestMode, &c.ActivatedAt, &c.HistoryID, &c.PageToken, &c.RecoveryID, &c.WatchExpiresAt)
	return c, err
}

func gmailHTTP() *http.Client { return &http.Client{Timeout: 15 * time.Second} }
func (s *Server) gmailClient(ctx context.Context, c gmailConnection) (*gmail.Client, error) {
	refresh, err := gmail.Open(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), c.Cipher, c.UserID+":token")
	if err != nil {
		return nil, err
	}
	token, err := gmail.Exchange(ctx, gmailHTTP(), url.Values{"client_id": {os.Getenv("GOOGLE_CLIENT_ID")}, "client_secret": {os.Getenv("GOOGLE_CLIENT_SECRET")}, "refresh_token": {refresh}, "grant_type": {"refresh_token"}})
	if err != nil {
		return nil, err
	}
	if token.Refresh != "" && token.Refresh != refresh {
		cipher, err := gmail.Seal(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), token.Refresh, c.UserID+":token")
		if err != nil {
			return nil, err
		}
		if err := s.db.QueryRow(ctx, `update gmail_connections set refresh_token_ciphertext=$2 where id=$1 and refresh_token_ciphertext=$3 returning id::text`, c.ID, cipher, c.Cipher).Scan(new(string)); err != nil {
			return nil, err
		}
	}
	return gmail.NewClient(token.Access), nil
}

func (s *Server) gmailConnect(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("GOOGLE_CLIENT_ID") == "" || os.Getenv("GOOGLE_CLIENT_SECRET") == "" || os.Getenv("GMAIL_REDIRECT_URL") == "" {
		writeError(w, 503, "Gmail OAuth not configured")
		return
	}
	if _, err := gmail.Seal(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), "check", userID(r)); err != nil {
		writeError(w, 503, "Gmail encryption not configured")
		return
	}
	state, err := randomToken("zfe_gmail")
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	if err := s.db.QueryRow(r.Context(), `with expired as (delete from gmail_oauth_states where expires_at<now()) insert into gmail_oauth_states(state_hash,user_id,expires_at) values($1,$2,now()+interval '10 minutes') returning state_hash`, hashSecret(state), userID(r)).Scan(new(string)); err != nil {
		s.gmailError(w, r, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "zfe_gmail_state", Value: state, Path: "/", HttpOnly: true, Secure: appEnv() == "production", SameSite: http.SameSiteLaxMode, MaxAge: 600})
	q := url.Values{"client_id": {os.Getenv("GOOGLE_CLIENT_ID")}, "redirect_uri": {os.Getenv("GMAIL_REDIRECT_URL")}, "response_type": {"code"}, "scope": {"openid email " + gmailScope}, "state": {state}, "access_type": {"offline"}, "prompt": {"consent"}, "login_hint": {os.Getenv("GMAIL_OWNER_EMAIL")}}
	http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+q.Encode(), 302)
}

func (s *Server) gmailCallback(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("zfe_gmail_state")
	state := r.URL.Query().Get("state")
	if err != nil || state == "" || cookie.Value != state {
		writeError(w, 400, "invalid OAuth state")
		return
	}
	if err := s.db.QueryRow(r.Context(), `delete from gmail_oauth_states where state_hash=$1 and user_id=$2 and expires_at>now() returning state_hash`, hashSecret(state), userID(r)).Scan(new(string)); err != nil {
		writeError(w, 400, "expired or used OAuth state")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "zfe_gmail_state", Path: "/", HttpOnly: true, Secure: appEnv() == "production", SameSite: http.SameSiteLaxMode, MaxAge: -1})
	if r.URL.Query().Get("error") != "" || r.URL.Query().Get("code") == "" {
		writeError(w, 400, "Gmail authorization denied")
		return
	}
	token, err := gmail.Exchange(r.Context(), gmailHTTP(), url.Values{"client_id": {os.Getenv("GOOGLE_CLIENT_ID")}, "client_secret": {os.Getenv("GOOGLE_CLIENT_SECRET")}, "redirect_uri": {os.Getenv("GMAIL_REDIRECT_URL")}, "code": {r.URL.Query().Get("code")}, "grant_type": {"authorization_code"}})
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	if !hasGmailScope(token.Scope) {
		writeError(w, 400, "Gmail readonly consent required")
		return
	}
	profile, err := fetchGoogleUserInfo(r, token.Access)
	if err != nil || !profile.EmailVerified {
		writeError(w, 400, "Google identity verification failed")
		return
	}
	var expectedID, email string
	err = s.db.QueryRow(r.Context(), `select provider_user_id,email from oauth_accounts where user_id=$1 and provider='google' and deleted_at is null`, userID(r)).Scan(&expectedID, &email)
	if err != nil || profile.ID != expectedID || !strings.EqualFold(profile.Email, email) {
		writeError(w, 403, "same Google account required")
		return
	}
	var cipher string
	if token.Refresh != "" {
		cipher, err = gmail.Seal(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), token.Refresh, userID(r)+":token")
		if err != nil {
			s.gmailError(w, r, err)
			return
		}
	} else {
		existing, e := s.gmailLoad(r.Context(), userID(r))
		if e != nil || existing.Cipher == "" {
			writeError(w, 400, "offline consent required; reconnect Gmail")
			return
		}
		cipher = existing.Cipher
	}
	// Reconnection preserves activation/cursors and dedup records. Initial consent
	// creates an inactive integration; no historic mail is imported automatically.
	err = s.db.QueryRow(r.Context(), `insert into gmail_connections(user_id,email,refresh_token_ciphertext) values($1,$2,$3) on conflict(user_id) do update set refresh_token_ciphertext=excluded.refresh_token_ciphertext,email=excluded.email,last_error=null,updated_at=now() returning id::text`, userID(r), profile.Email, cipher).Scan(new(string))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]string{"status": "connected"})
}
func hasGmailScope(scopes string) bool {
	for _, scope := range strings.Fields(scopes) {
		if scope == gmailScope {
			return true
		}
	}
	return false
}

func (s *Server) gmailStatus(w http.ResponseWriter, r *http.Request) {
	var out json.RawMessage
	err := s.db.QueryRow(r.Context(), `select jsonb_build_object(
	 'connected',refresh_token_ciphertext is not null,'enabled',enabled,'email',email,
	 'wallet_id',wallet_id,'test_mode',test_mode,'activated_at',activated_at,
	 'watch_expires_at',watch_expires_at,'last_sync_at',last_sync_at,'last_error',last_error,
	 'counts',(select jsonb_build_object('imported',count(*) filter(where status='imported'),'failed',count(*) filter(where status='failed')) from gmail_messages m where m.connection_id=c.id),
	 'latest_import',(select jsonb_build_object('received_at',received_at,'processed_at',processed_at,'delay_seconds',extract(epoch from processed_at-received_at)) from gmail_messages m where m.connection_id=c.id and status='imported' order by processed_at desc limit 1),
	 'recent_failures',(select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from (select message_id,error_code,processed_at from gmail_messages m where m.connection_id=c.id and status='failed' order by processed_at desc limit 10) f)
	) from gmail_connections c where user_id=$1`, userID(r)).Scan(&out)
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, 200, map[string]bool{"connected": false, "enabled": false})
		return
	}
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	writeRawJSON(w, 200, out)
}

func (s *Server) gmailSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WalletID         string `json:"wallet_id"`
		RecipientAccount string `json:"recipient_account"`
		Enabled          bool   `json:"enabled"`
		TestMode         bool   `json:"test_mode"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	c, err := s.gmailLoad(r.Context(), userID(r))
	if err != nil || c.Cipher == "" {
		writeError(w, 409, "connect Gmail first")
		return
	}
	if !body.Enabled && body.WalletID == "" {
		err = s.db.QueryRow(r.Context(), `update gmail_connections set enabled=false,updated_at=now() where id=$1 and (lease_until is null or lease_until<now()) returning id::text`, c.ID).Scan(new(string))
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, 409, "sync in progress; retry")
			return
		}
		if err != nil {
			s.gmailError(w, r, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"enabled": false})
		return
	}
	account := strings.ReplaceAll(strings.TrimSpace(body.RecipientAccount), " ", "")
	if !regexp.MustCompile(`^[0-9]{6,30}$`).MatchString(account) {
		writeError(w, 400, "recipient_account must contain 6-30 digits")
		return
	}
	var walletCurrency string
	err = s.db.QueryRow(r.Context(), `select currency from wallets where id::text=$1 and user_id=$2 and deleted_at is null and is_active=true`, body.WalletID, userID(r)).Scan(&walletCurrency)
	if err != nil || walletCurrency != "IDR" {
		writeError(w, 400, "active IDR wallet belonging to owner required")
		return
	}
	cipher, err := gmail.Seal(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), account, c.UserID+":account")
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	// Configuration cannot change under a running import/sync. Lease acquisition is
	// database-wide, so this is safe across serverless instances.
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
	var history any = c.HistoryID
	activated := c.ActivatedAt
	if body.Enabled && activated == nil {
		client, err := s.gmailClient(r.Context(), c)
		if err != nil {
			s.gmailError(w, r, err)
			return
		}
		p, err := client.Profile(r.Context())
		if err != nil {
			s.gmailError(w, r, err)
			return
		}
		if p.HistoryID == "" || !strings.EqualFold(p.Email, c.Email) {
			writeError(w, 502, "invalid Gmail profile")
			return
		}
		history = p.HistoryID
		now := time.Now().UTC()
		activated = &now
	}
	err = s.db.QueryRow(r.Context(), `update gmail_connections set wallet_id=$2,recipient_account_ciphertext=$3,enabled=$4,test_mode=$5,history_id=$6,activated_at=$7,updated_at=now() where id=$1 and lease_id=$8 returning id::text`, c.ID, body.WalletID, cipher, body.Enabled, body.TestMode, history, activated, lease).Scan(new(string))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]bool{"enabled": body.Enabled, "test_mode": body.TestMode})
}

func (s *Server) gmailError(w http.ResponseWriter, r *http.Request, err error) {
	code := "gmail_operation_failed"
	status := 502
	var api *gmail.APIError
	if errors.As(err, &api) {
		code = api.Error()
		if api.Code == "reauthorization_required" {
			status = 409
		}
	}
	// Do not expose SQL errors, OAuth response bodies, addresses, or tokens.
	writeError(w, status, code)
}

func (s *Server) gmailDisconnect(w http.ResponseWriter, r *http.Request) {
	c, err := s.gmailLoad(r.Context(), userID(r))
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, 200, map[string]string{"status": "disconnected"})
		return
	}
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	lease, err := s.gmailLease(r.Context(), c.ID)
	if err != nil {
		writeError(w, 409, "sync in progress; retry")
		return
	}
	defer s.gmailRelease(r.Context(), c.ID, lease)
	// Stop local writes before making external requests. On revocation failure,
	// retain encrypted credential only to retry disconnect; never keep sync enabled.
	c, err = s.gmailLoad(r.Context(), userID(r))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	if err := s.db.QueryRow(r.Context(), `update gmail_connections set enabled=false where id=$1 and lease_id=$2 returning id::text`, c.ID, lease).Scan(new(string)); err != nil {
		s.gmailError(w, r, err)
		return
	}
	if c.Cipher != "" {
		client, clientErr := s.gmailClient(r.Context(), c)
		if clientErr == nil {
			if err := client.Stop(r.Context()); err != nil {
				s.gmailError(w, r, err)
				return
			}
		}
		var api *gmail.APIError
		if clientErr != nil && !(errors.As(clientErr, &api) && api.Code == "reauthorization_required") {
			s.gmailError(w, r, clientErr)
			return
		}
		refresh, err := gmail.Open(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), c.Cipher, c.UserID+":token")
		if err != nil {
			s.gmailError(w, r, err)
			return
		}
		if clientErr == nil {
			if err := gmail.Revoke(r.Context(), refresh); err != nil {
				s.gmailError(w, r, err)
				return
			}
		}
	}
	err = s.db.QueryRow(r.Context(), `update gmail_connections set refresh_token_ciphertext=null,recipient_account_ciphertext=null,watch_expires_at=null,activated_at=null,history_id=null,page_token=null,recovery_history_id=null,last_error=null,updated_at=now() where id=$1 and lease_id=$2 returning id::text`, c.ID, lease).Scan(new(string))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]string{"status": "disconnected", "notice": "Google revocation also removes other OAuth grants for this project; existing ERP session is retained"})
}

func (s *Server) gmailLease(ctx context.Context, id string) (string, error) {
	lease, err := randomToken("lease")
	if err != nil {
		return "", err
	}
	err = s.db.QueryRow(ctx, `update gmail_connections set lease_id=$2,lease_until=now()+interval '90 seconds' where id=$1 and (lease_until is null or lease_until<now()) returning id::text`, id, lease).Scan(new(string))
	return lease, err
}
func (s *Server) gmailRelease(ctx context.Context, id, lease string) {
	// A cancelled request must still release its lease. It expires if DB is down.
	releaseCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer cancel()
	_ = s.db.QueryRow(releaseCtx, `update gmail_connections set lease_id=null,lease_until=null where id=$1 and lease_id=$2 returning id::text`, id, lease).Scan(new(string))
}

func gmailMessageID(w http.ResponseWriter, r *http.Request) string {
	var body struct {
		ID string `json:"message_id"`
	}
	if !decodeBody(w, r, &body) {
		return ""
	}
	if !regexp.MustCompile(`^[a-zA-Z0-9_-]{1,128}$`).MatchString(body.ID) {
		writeError(w, 400, "invalid message_id")
		return ""
	}
	return body.ID
}

func (s *Server) gmailCandidates(w http.ResponseWriter, r *http.Request) {
	page := r.URL.Query().Get("page_token")
	if len(page) > 4096 {
		writeError(w, 400, "invalid page_token")
		return
	}
	c, err := s.gmailLoad(r.Context(), userID(r))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	client, err := s.gmailClient(r.Context(), c)
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	list, err := client.Search(r.Context(), time.Unix(0, 0), page)
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	ids := make([]string, 0, len(list.Messages))
	for _, message := range list.Messages {
		ids = append(ids, message.ID)
	}
	writeJSON(w, 200, map[string]any{"message_ids": ids, "next_page_token": list.NextPageToken, "authentication_verified": false})
}
func (s *Server) gmailPreview(w http.ResponseWriter, r *http.Request) {
	id := gmailMessageID(w, r)
	if id == "" {
		return
	}
	c, err := s.gmailLoad(r.Context(), userID(r))
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	client, err := s.gmailClient(r.Context(), c)
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	m, err := client.Message(r.Context(), id, "raw")
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	b, err := m.Bytes()
	if err != nil {
		s.gmailError(w, r, err)
		return
	}
	receipt, err := gmail.Parse(b, true)
	if err != nil {
		writeError(w, 422, err.Error())
		return
	}
	last4 := ""
	if len(receipt.RecipientAccount) >= 4 {
		last4 = receipt.RecipientAccount[len(receipt.RecipientAccount)-4:]
	}
	writeJSON(w, 200, map[string]any{"message_id": id, "receipt": receipt, "recipient_account_last4": last4, "writes_transaction": false})
}
