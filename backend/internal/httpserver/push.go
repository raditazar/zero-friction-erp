package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const pushSendTimeout = 3 * time.Second

// rowsExecer is implemented by *pgxpool.Pool; push is skipped for test doubles that lack it.
type rowsExecer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// sendWebPush is a seam for tests.
var sendWebPush = func(ctx context.Context, payload []byte, sub *webpush.Subscription, opts *webpush.Options) (*http.Response, error) {
	return webpush.SendNotificationWithContext(ctx, payload, sub, opts)
}

type vapidConfig struct {
	Public, Private, Subject string
}

func loadVAPID() (vapidConfig, bool) {
	c := vapidConfig{
		Public:  strings.TrimSpace(os.Getenv("VAPID_PUBLIC_KEY")),
		Private: strings.TrimSpace(os.Getenv("VAPID_PRIVATE_KEY")),
		Subject: strings.TrimSpace(os.Getenv("VAPID_SUBJECT")),
	}
	if c.Subject == "" {
		c.Subject = "mailto:admin@localhost"
	}
	return c, c.Public != "" && c.Private != ""
}

func (s *Server) registerPush(mux *http.ServeMux) {
	mux.HandleFunc("GET /push/config", s.handlePushConfig)
	mux.HandleFunc("POST /push/subscriptions", s.handlePushSubscribe)
	mux.HandleFunc("DELETE /push/subscriptions", s.handlePushUnsubscribe)
}

func (s *Server) handlePushConfig(w http.ResponseWriter, r *http.Request) {
	cfg, ok := loadVAPID()
	writeJSON(w, http.StatusOK, map[string]any{"enabled": ok, "public_key": cfg.Public})
}

type pushSubscriptionBody struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	UserAgent string `json:"user_agent"`
}

func (s *Server) handlePushSubscribe(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	var body pushSubscriptionBody
	if !decodeBody(w, r, &body) {
		return
	}
	body.Endpoint = strings.TrimSpace(body.Endpoint)
	if body.Endpoint == "" || body.Keys.P256dh == "" || body.Keys.Auth == "" {
		writeError(w, http.StatusBadRequest, "endpoint, keys.p256dh and keys.auth are required")
		return
	}
	if !strings.HasPrefix(body.Endpoint, "https://") {
		writeError(w, http.StatusBadRequest, "endpoint must be an https URL")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `
		insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
		values ($1::uuid, $2, $3, $4, nullif($5, ''))
		on conflict (endpoint) do update
		set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
		    user_agent = excluded.user_agent
		returning id::text
	`, userID(r), body.Endpoint, body.Keys.P256dh, body.Keys.Auth, body.UserAgent).Scan(&id)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) handlePushUnsubscribe(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.Endpoint) == "" {
		writeError(w, http.StatusBadRequest, "endpoint is required")
		return
	}
	// Scoped to the caller so one user cannot drop another user's subscription.
	var id string
	err := s.db.QueryRow(r.Context(), `
		delete from push_subscriptions where user_id = $1::uuid and endpoint = $2 returning id::text
	`, userID(r), strings.TrimSpace(body.Endpoint)).Scan(&id)
	if err != nil && err != pgx.ErrNoRows {
		s.writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "unsubscribed"})
}

type pushPayload struct {
	Title        string `json:"title"`
	Body         string `json:"body"`
	URL          string `json:"url"`
	Tag          string `json:"tag"`
	PendingCount int    `json:"pending_count"`
}

func formatRupiah(amount float64) string {
	n := int64(amount + 0.5)
	s := fmt.Sprintf("%d", n)
	var out []byte
	for i, c := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, c)
	}
	return "Rp" + string(out)
}

// notifyNewInboxItem pushes "new transaction" to every device the user subscribed.
// Best effort: it never fails the ingest. It runs synchronously because a serverless
// function may be frozen right after the response, with a hard overall timeout.
func (s *Server) notifyNewInboxItem(ctx context.Context, uid, txID, merchant string, amount float64) {
	cfg, ok := loadVAPID()
	db, hasDB := s.db.(rowsExecer)
	if !ok || !hasDB {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, pushSendTimeout)
	defer cancel()

	var pending int
	_ = s.db.QueryRow(ctx, `
		select count(*)::int from transactions
		where user_id = $1::uuid and status in ('pending', 'needs_review') and deleted_at is null
	`, uid).Scan(&pending)

	label := strings.TrimSpace(merchant)
	if label == "" {
		label = "transaksi baru"
	}
	payload, _ := json.Marshal(pushPayload{
		Title:        "Transaksi baru di Kotak Masuk",
		Body:         fmt.Sprintf("%s — %s", formatRupiah(amount), label),
		URL:          "/inbox?id=" + txID,
		Tag:          "inbox-" + txID,
		PendingCount: pending,
	})

	rows, err := db.Query(ctx, `select endpoint, p256dh, auth from push_subscriptions where user_id = $1::uuid`, uid)
	if err != nil {
		s.logger.Warn("push: list subscriptions failed", "error", err)
		return
	}
	type sub struct{ endpoint, p256dh, auth string }
	var subs []sub
	for rows.Next() {
		var x sub
		if err := rows.Scan(&x.endpoint, &x.p256dh, &x.auth); err == nil {
			subs = append(subs, x)
		}
	}
	rows.Close()

	for _, x := range subs {
		resp, err := sendWebPush(ctx, payload, &webpush.Subscription{
			Endpoint: x.endpoint,
			Keys:     webpush.Keys{P256dh: x.p256dh, Auth: x.auth},
		}, &webpush.Options{
			Subscriber:      cfg.Subject,
			VAPIDPublicKey:  cfg.Public,
			VAPIDPrivateKey: cfg.Private,
			TTL:             3600,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			s.logger.Warn("push: send failed", "error", err)
			continue
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		switch {
		case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
			// Subscription is dead (uninstalled PWA / revoked permission).
			_, _ = db.Exec(ctx, `delete from push_subscriptions where endpoint = $1`, x.endpoint)
		case resp.StatusCode >= 200 && resp.StatusCode < 300:
			_, _ = db.Exec(ctx, `update push_subscriptions set last_used_at = now() where endpoint = $1`, x.endpoint)
		default:
			s.logger.Warn("push: unexpected status", "status", resp.StatusCode)
		}
	}
}
