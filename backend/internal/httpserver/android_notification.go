package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"zero-friction-erp/backend/internal/android"
	"zero-friction-erp/backend/internal/dedup"
)

func (s *Server) registerAndroid(mux *http.ServeMux) {
	mux.HandleFunc("POST /integrations/android/notifications", s.withWebhookAuth(s.handleAndroidNotification))
	mux.HandleFunc("POST /integrations/android/test-push", s.withWebhookOrUserAuth(s.handleAndroidTestPush))
	mux.Handle("GET /integrations/android/devices", s.withUserAuth(http.HandlerFunc(s.handleAndroidDevices)))
}

func (s *Server) withWebhookOrUserAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			token = strings.TrimSpace(r.Header.Get("X-Webhook-Token"))
		}
		if token == "" {
			token = strings.TrimSpace(r.URL.Query().Get("token"))
		}
		if strings.HasPrefix(token, "zfe_wh_") {
			userID, err := s.validateWebhookToken(r, token)
			if err != nil {
				s.writeAuthError(w, err)
				return
			}
			next(w, withUserID(r, userID))
			return
		}
		s.withUserAuth(next).ServeHTTP(w, r)
	}
}

func (s *Server) handleAndroidNotification(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}

	var payload android.NotificationPayload
	if !decodeBody(w, r, &payload) {
		return
	}

	// 1. Heartbeat / upsert into device_registrations
	_ = s.upsertDeviceRegistration(r.Context(), userID(r), payload.DeviceID, payload.AppName)

	// 2. Parse and filter spam/promo/OTP
	parsed, err := android.Parse(payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if parsed.IsFiltered {
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "filtered",
			"reason": parsed.FilterReason,
		})
		return
	}

	// 3. Multi-tier anti-duplication check
	dedupRes, err := dedup.Check(r.Context(), s.db, dedup.CheckParams{
		UserID:    userID(r),
		Source:    "android",
		DeviceID:  payload.DeviceID,
		AppName:   payload.AppName,
		Amount:    parsed.Amount,
		Merchant:  parsed.Merchant,
		RefNumber: parsed.RefNumber,
		PostedAt:  parsed.TransactionAt,
		RawText:   payload.Text,
	})
	if err != nil {
		s.writeDBError(w, err)
		return
	}

	if dedupRes.Action == dedup.ActionDrop {
		_ = s.recordWebhookEvent(r.Context(), userID(r), "android", "duplicate", payload.DeviceID, dedupRes.DedupHash, dedupRes.DuplicateOf, payload)
		writeJSON(w, http.StatusOK, map[string]any{
			"status":       "duplicate_dropped",
			"duplicate_of": dedupRes.DuplicateOf,
			"layer":        dedupRes.Layer,
		})
		return
	}

	if dedupRes.Action == dedup.ActionMerge {
		_ = s.appendTransactionEvidence(r.Context(), userID(r), dedupRes.DuplicateOf, payload.Text)
		_ = s.recordWebhookEvent(r.Context(), userID(r), "android", "processed", payload.DeviceID, dedupRes.DedupHash, dedupRes.DuplicateOf, payload)
		writeJSON(w, http.StatusOK, map[string]any{
			"status":       "duplicate_merged",
			"duplicate_of": dedupRes.DuplicateOf,
			"layer":        dedupRes.Layer,
		})
		return
	}

	// 4. Wallet matching & transfer destination matching
	walletID, _ := s.findBestWalletForAndroid(r, parsed.ProviderSlug)
	if walletID == "" {
		writeError(w, http.StatusBadRequest, "no active wallet found for user")
		return
	}

	var destWalletID string
	if parsed.Type == "transfer" && parsed.DestinationWalletHint != "" {
		destWalletID, _ = s.bestDestinationWalletID(r, walletID, parsed.DestinationWalletHint)
	}

	// 5. Category matching
	categoryID, _ := s.bestCategoryID(r, parsed.Type, parsed.Merchant)

	// 6. Insert transaction into Staging Inbox (needs_review)
	txJSON, err := s.insertAndroidTransaction(r, parsed, payload, walletID, categoryID, destWalletID, dedupRes)
	if err != nil {
		s.writeDBError(w, err)
		return
	}

	_ = s.recordWebhookEvent(r.Context(), userID(r), "android", "processed", payload.DeviceID, dedupRes.DedupHash, dedupRes.DuplicateOf, payload)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"status":      "accepted",
		"transaction": txJSON,
		"dedup":       dedupRes,
	})
}

func (s *Server) handleAndroidTestPush(w http.ResponseWriter, r *http.Request) {
	var payload android.NotificationPayload
	if !decodeBody(w, r, &payload) {
		return
	}

	parsed, err := android.Parse(payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	walletMatch := s.getWalletMatchDiagnostic(r, parsed.ProviderSlug)

	dedupRes, _ := dedup.Check(r.Context(), s.db, dedup.CheckParams{
		UserID:    userID(r),
		Source:    "android",
		DeviceID:  payload.DeviceID,
		AppName:   payload.AppName,
		Amount:    parsed.Amount,
		Merchant:  parsed.Merchant,
		RefNumber: parsed.RefNumber,
		PostedAt:  parsed.TransactionAt,
		RawText:   payload.Text,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "test_success",
		"parsed": map[string]any{
			"amount":        parsed.Amount,
			"merchant":      parsed.Merchant,
			"type":          parsed.Type,
			"provider_slug": parsed.ProviderSlug,
			"ref_number":    parsed.RefNumber,
		},
		"wallet_match": walletMatch,
		"dedup":        dedupRes,
		"filter": map[string]any{
			"is_filtered": parsed.IsFiltered,
			"reason":      parsed.FilterReason,
		},
	})
}

func (s *Server) handleAndroidDevices(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(d) order by d.last_seen_at desc nulls last), '[]'::jsonb)
		from device_registrations d
		where d.user_id = $1::uuid
	`, userID(r))
}

func (s *Server) upsertDeviceRegistration(ctx context.Context, uid, deviceID, deviceLabel string) error {
	if s.db == nil {
		return nil
	}
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		deviceID = "android-device"
	}
	label := strings.TrimSpace(deviceLabel)
	if label == "" {
		label = "Android Device"
	}
	var id string
	return s.db.QueryRow(ctx, `
		insert into device_registrations (user_id, device_id, device_label, platform, last_seen_at, events_count)
		values ($1::uuid, $2, $3, 'android', now(), 1)
		on conflict (user_id, device_id) do update
		set last_seen_at = now(),
		    device_label = coalesce(nullif($3, ''), device_registrations.device_label),
		    events_count = device_registrations.events_count + 1
		returning id::text
	`, uid, deviceID, label).Scan(&id)
}

func (s *Server) findBestWalletForAndroid(r *http.Request, providerSlug string) (string, error) {
	if s.db == nil {
		return "", fmt.Errorf("database is not configured")
	}

	slug := strings.TrimSpace(providerSlug)
	var walletID string

	// 1. Try matching provider_slug or wallet name/provider
	err := s.db.QueryRow(r.Context(), `
		select id::text
		from wallets
		where user_id = $1::uuid and deleted_at is null
		order by
			case
				when lower(coalesce(provider_slug, '')) = lower($2) and $2 <> '' then 0
				when lower(name) = lower($2) and $2 <> '' then 1
				when lower(coalesce(provider, '')) = lower($2) and $2 <> '' then 2
				else 3
			end,
			case when is_active then 0 else 1 end,
			created_at
		limit 1
	`, userID(r), slug).Scan(&walletID)
	if err == nil && walletID != "" {
		return walletID, nil
	}

	// 2. Fallback to any active wallet
	err = s.db.QueryRow(r.Context(), `
		select id::text
		from wallets
		where user_id = $1::uuid and deleted_at is null
		order by case when is_active then 0 else 1 end, created_at
		limit 1
	`, userID(r)).Scan(&walletID)
	return walletID, err
}

func (s *Server) getWalletMatchDiagnostic(r *http.Request, providerSlug string) any {
	if s.db == nil {
		return nil
	}
	slug := strings.TrimSpace(providerSlug)
	var walletID, walletName string
	err := s.db.QueryRow(r.Context(), `
		select id::text, name
		from wallets
		where user_id = $1::uuid and deleted_at is null
		order by
			case
				when lower(coalesce(provider_slug, '')) = lower($2) and $2 <> '' then 0
				when lower(name) = lower($2) and $2 <> '' then 1
				when lower(coalesce(provider, '')) = lower($2) and $2 <> '' then 2
				else 3
			end,
			case when is_active then 0 else 1 end,
			created_at
		limit 1
	`, userID(r), slug).Scan(&walletID, &walletName)
	if err != nil || walletID == "" {
		return nil
	}
	return map[string]any{
		"id":   walletID,
		"name": walletName,
	}
}

func (s *Server) appendTransactionEvidence(ctx context.Context, uid, txID, evidence string) error {
	if s.db == nil {
		return fmt.Errorf("database is not configured")
	}
	var updatedID string
	return s.db.QueryRow(ctx, `
		update transactions
		set raw_input = case
			when raw_input is null or raw_input = '' then $3
			else raw_input || E'\n---\n[Merged Evidence]: ' || $3
		end
		where user_id = $1::uuid and id = $2::uuid and deleted_at is null
		returning id::text
	`, uid, txID, evidence).Scan(&updatedID)
}

func (s *Server) recordWebhookEvent(
	ctx context.Context,
	uid string,
	source string,
	status string,
	deviceID string,
	dedupHash string,
	duplicateOfID string,
	payload any,
) error {
	if s.db == nil {
		return fmt.Errorf("database is not configured")
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		payloadBytes = []byte("{}")
	}
	idempotencyKey := fmt.Sprintf("%s_%s_%d", source, dedupHash, time.Now().UnixNano())
	var eventID string
	return s.db.QueryRow(ctx, `
		insert into webhook_events (user_id, source, idempotency_text, payload, status, device_id, dedup_hash, duplicate_of_id)
		values ($1::uuid, $2::webhook_source, $3, $4::jsonb, $5::webhook_status, nullif($6, ''), nullif($7, ''), nullif($8, '')::uuid)
		on conflict (user_id, idempotency_text) do nothing
		returning id::text
	`, uid, source, idempotencyKey, string(payloadBytes), status, deviceID, dedupHash, duplicateOfID).Scan(&eventID)
}

func (s *Server) insertAndroidTransaction(
	r *http.Request,
	parsed android.ParsedNotification,
	payload android.NotificationPayload,
	walletID string,
	categoryID string,
	destWalletID string,
	dedupRes dedup.CheckResult,
) (json.RawMessage, error) {
	txAt := parsed.TransactionAt
	if txAt.IsZero() {
		txAt = time.Now().UTC()
	}

	rawInput := payload.Text
	if strings.TrimSpace(payload.Title) != "" {
		rawInput = payload.Title + ": " + payload.Text
	}

	duplicateOfID := ""
	if dedupRes.Action == dedup.ActionWarn && dedupRes.DuplicateOf != "" {
		duplicateOfID = dedupRes.DuplicateOf
	}

	var txJSON json.RawMessage
	err := s.db.QueryRow(r.Context(), `
		insert into transactions (
			user_id,
			wallet_id,
			destination_wallet_id,
			type,
			status,
			transaction_at,
			merchant,
			amount,
			category_id,
			is_reimbursement,
			reimbursement_status,
			note,
			input_source,
			input_mode,
			raw_input,
			dedup_hash,
			duplicate_of_id
		) values (
			$1::uuid,
			$2::uuid,
			nullif($3, '')::uuid,
			$4::transaction_type,
			'needs_review'::transaction_status,
			$5::timestamptz,
			$6,
			$7,
			nullif($8, '')::uuid,
			false,
			'none'::reimbursement_status,
			$9,
			'android'::input_source,
			'notification'::input_mode,
			$10,
			$11,
			nullif($12, '')::uuid
		)
		returning to_jsonb(transactions.*)
	`,
		userID(r),
		walletID,
		destWalletID,
		parsed.Type,
		txAt,
		parsed.Merchant,
		parsed.Amount,
		categoryID,
		parsed.Note,
		rawInput,
		dedupRes.DedupHash,
		duplicateOfID,
	).Scan(&txJSON)

	return txJSON, err
}
