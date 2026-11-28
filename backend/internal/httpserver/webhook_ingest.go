package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// webhookOutcome is what happened to one webhook event after processing.
type webhookOutcome struct {
	Status      string          // accepted | dead_lettered | duplicate
	Event       json.RawMessage // webhook_events row
	Transaction json.RawMessage // created transaction, when accepted
	DeadLetter  json.RawMessage // dead_letter_queue row, when dead_lettered
}

func (o webhookOutcome) httpStatus() int {
	switch o.Status {
	case "duplicate":
		return http.StatusOK
	case "dead_lettered":
		return http.StatusAccepted
	default:
		return http.StatusAccepted
	}
}

func (o webhookOutcome) body() map[string]any {
	body := map[string]any{"status": o.Status, "webhook_event": o.Event}
	if o.Transaction != nil {
		body["transaction"] = o.Transaction
		body["received_at"] = time.Now().UTC()
	}
	if o.DeadLetter != nil {
		body["dead_letter"] = o.DeadLetter
	}
	return body
}

// ingestWebhook records the event and turns it into a pending transaction in one DB
// transaction. Rules:
//   - A new event is processed.
//   - A repeat of an event that was processed (or recorded as a duplicate) is a duplicate.
//   - A repeat of an event that failed or never finished is processed again with the new body,
//     so a client retry after an error is not swallowed as a duplicate.
//   - Bad data (missing fields, a wallet the user does not own) goes to the dead-letter queue
//     and the event is marked failed. Database outages roll everything back so the client's
//     retry starts clean.
func (s *Server) ingestWebhook(ctx context.Context, uid, source, idempotencyText string, body []byte) (webhookOutcome, error) {
	var outcome webhookOutcome
	err := s.withTx(ctx, func(q rowQuerier) error {
		outcome = webhookOutcome{}
		if err := lockUserIngest(ctx, q, uid); err != nil {
			return err
		}

		var eventID, eventStatus string
		err := q.QueryRow(ctx, `
			insert into webhook_events (user_id, source, idempotency_text, payload, status)
			values ($1, $2::webhook_source, $3, $4::jsonb, 'received')
			on conflict (user_id, idempotency_text) do nothing
			returning id::text, status::text
		`, uid, source, idempotencyText, string(body)).Scan(&eventID, &eventStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			err = q.QueryRow(ctx, `
				select id::text, status::text from webhook_events
				where user_id = $1 and idempotency_text = $2 and deleted_at is null
			`, uid, idempotencyText).Scan(&eventID, &eventStatus)
			if err != nil {
				return err
			}
			if eventStatus == "processed" || eventStatus == "duplicate" {
				outcome.Status = "duplicate"
				return q.QueryRow(ctx, `select to_jsonb(e) from webhook_events e where e.id = $1`, eventID).Scan(&outcome.Event)
			}
			// failed or stuck in received: take the new body and process again.
			if err := q.QueryRow(ctx, `
				update webhook_events set payload = $2::jsonb, status = 'received'
				where id = $1 returning id::text
			`, eventID, string(body)).Scan(&eventID); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		var procErr error
		outcome, procErr = s.processWebhookEvent(ctx, q, uid, eventID, source, body)
		return procErr
	})
	return outcome, err
}

// processWebhookEvent turns a received event into a pending transaction, or dead-letters it.
// It must run inside a DB transaction (q); the transaction insert runs in a savepoint so a
// rejected row does not abort the surrounding work.
func (s *Server) processWebhookEvent(ctx context.Context, q rowQuerier, uid, eventID, source string, body []byte) (webhookOutcome, error) {
	var payload transactionPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return s.deadLetterEvent(ctx, q, uid, eventID, body, "webhook payload is not valid JSON")
	}
	if missing(payload.WalletID) || missing(payload.Type) || payload.Amount == nil {
		return s.deadLetterEvent(ctx, q, uid, eventID, body, "webhook payload missing wallet_id, type, or amount")
	}

	status := "pending"
	payload.Status = &status
	mode := "text"
	payload.InputSource = &source
	payload.InputMode = &mode
	if payload.RawInput == nil {
		raw := string(body)
		payload.RawInput = &raw
	}
	normalizeTransactionPayload(&payload)
	transactionAt := time.Now().UTC().Format(time.RFC3339)
	if payload.TransactionAt != nil && strings.TrimSpace(*payload.TransactionAt) != "" {
		transactionAt = *payload.TransactionAt
	}

	var txJSON json.RawMessage
	insertErr := withSavepoint(ctx, q, func(sp rowQuerier) error {
		return sp.QueryRow(ctx, createTransactionSQL(), transactionArgs(uid, payload, transactionAt)...).Scan(&txJSON)
	})
	if insertErr != nil {
		if _, message, ok := clientDBError(insertErr); ok {
			return s.deadLetterEvent(ctx, q, uid, eventID, body, message)
		}
		return webhookOutcome{}, insertErr
	}

	outcome := webhookOutcome{Status: "accepted", Transaction: txJSON}
	err := q.QueryRow(ctx, `
		update webhook_events set status = 'processed' where id = $1
		returning to_jsonb(webhook_events.*)
	`, eventID).Scan(&outcome.Event)
	return outcome, err
}

func (s *Server) deadLetterEvent(ctx context.Context, q rowQuerier, uid, eventID string, body []byte, reason string) (webhookOutcome, error) {
	outcome := webhookOutcome{Status: "dead_lettered"}
	payload := string(body)
	if !json.Valid(body) {
		quoted, _ := json.Marshal(payload)
		payload = string(quoted)
	}
	err := q.QueryRow(ctx, `
		insert into dead_letter_queue (user_id, webhook_event_id, raw_payload, error_msg, status)
		values ($1, $2, $3::jsonb, $4, 'open')
		returning to_jsonb(dead_letter_queue.*)
	`, uid, eventID, payload, reason).Scan(&outcome.DeadLetter)
	if err != nil {
		return outcome, err
	}
	err = q.QueryRow(ctx, `
		update webhook_events set status = 'failed' where id = $1
		returning to_jsonb(webhook_events.*)
	`, eventID).Scan(&outcome.Event)
	return outcome, err
}

// withSavepoint runs fn in a nested transaction when q is a real transaction, so a failing
// statement only rolls back itself. With test doubles it runs fn directly.
func withSavepoint(ctx context.Context, q rowQuerier, fn func(rowQuerier) error) error {
	b, ok := q.(txBeginner)
	if !ok {
		return fn(q)
	}
	sp, err := b.Begin(ctx)
	if err != nil {
		return err
	}
	if err := fn(sp); err != nil {
		_ = sp.Rollback(ctx)
		return err
	}
	return sp.Commit(ctx)
}

// retryWebhookEvent reprocesses a failed or stuck iOS/generic webhook event. When override is
// set it replaces the stored payload first, so the user can fix the data (e.g. pick a wallet)
// before retrying. Android events are rebuilt from the notification, not retried here.
func (s *Server) retryWebhookEvent(ctx context.Context, uid, eventID string, override json.RawMessage) (webhookOutcome, error) {
	var outcome webhookOutcome
	err := s.withTx(ctx, func(q rowQuerier) error {
		if err := lockUserIngest(ctx, q, uid); err != nil {
			return err
		}
		var status, source string
		var payload json.RawMessage
		var fromDevice bool
		err := q.QueryRow(ctx, `
			select status::text, source::text, payload, device_id is not null
			from webhook_events
			where user_id = $1 and id = $2 and deleted_at is null
			for update
		`, uid, eventID).Scan(&status, &source, &payload, &fromDevice)
		if err != nil {
			return err
		}
		if status == "processed" || status == "duplicate" {
			return errAlreadyProcessed
		}
		if fromDevice {
			return errDeviceEvent
		}
		if len(override) > 0 {
			payload = override
			if err := q.QueryRow(ctx, `update webhook_events set payload = $2::jsonb where id = $1 returning id::text`, eventID, string(payload)).Scan(&eventID); err != nil {
				return err
			}
		}
		// Earlier dead letters for this event are superseded by this attempt.
		if err := execIgnoringNoRows(ctx, q, `
			update dead_letter_queue set status = 'resolved', resolved_at = now()
			where user_id = $1 and webhook_event_id = $2 and status = 'open'
			returning id
		`, uid, eventID); err != nil {
			return err
		}
		var procErr error
		outcome, procErr = s.processWebhookEvent(ctx, q, uid, eventID, source, payload)
		return procErr
	})
	return outcome, err
}

var (
	errAlreadyProcessed = errors.New("webhook event was already processed")
	errDeviceEvent      = errors.New("android events cannot be retried; resend the notification from the device")
)

// execIgnoringNoRows runs an UPDATE ... RETURNING through a rowQuerier and treats "no rows"
// as success.
func execIgnoringNoRows(ctx context.Context, q rowQuerier, sql string, args ...any) error {
	var ignored any
	err := q.QueryRow(ctx, sql, args...).Scan(&ignored)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	return err
}

func (s *Server) writeRetryResult(w http.ResponseWriter, outcome webhookOutcome, err error) {
	switch {
	case errors.Is(err, errAlreadyProcessed), errors.Is(err, errDeviceEvent):
		writeError(w, http.StatusConflict, err.Error())
	case err != nil:
		s.writeDBError(w, err)
	default:
		writeJSON(w, http.StatusOK, outcome.body())
	}
}

type retryPayload struct {
	Payload json.RawMessage `json:"payload"`
}

// readRetryOverride reads an optional {"payload": {...}} body. An empty body is fine.
func readRetryOverride(w http.ResponseWriter, r *http.Request) (json.RawMessage, bool) {
	if r.ContentLength == 0 {
		return nil, true
	}
	var p retryPayload
	if !decodeBody(w, r, &p) {
		return nil, false
	}
	if len(p.Payload) > 0 && !json.Valid(p.Payload) {
		writeError(w, http.StatusBadRequest, "payload must be a JSON object")
		return nil, false
	}
	return p.Payload, true
}

func (s *Server) handleRetryWebhookEvent(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	override, ok := readRetryOverride(w, r)
	if !ok {
		return
	}
	outcome, err := s.retryWebhookEvent(r.Context(), userID(r), r.PathValue("id"), override)
	s.writeRetryResult(w, outcome, err)
}

func (s *Server) handleRetryDeadLetter(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	override, ok := readRetryOverride(w, r)
	if !ok {
		return
	}
	var eventID *string
	var rawPayload json.RawMessage
	err := s.db.QueryRow(r.Context(), `
		select webhook_event_id::text, raw_payload from dead_letter_queue
		where user_id = $1 and id = $2 and deleted_at is null
	`, userID(r), r.PathValue("id")).Scan(&eventID, &rawPayload)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	if eventID == nil {
		writeError(w, http.StatusConflict, "this dead letter has no webhook event to retry")
		return
	}
	if len(override) == 0 {
		override = rawPayload
	}
	outcome, err := s.retryWebhookEvent(r.Context(), userID(r), *eventID, override)
	s.writeRetryResult(w, outcome, err)
}
