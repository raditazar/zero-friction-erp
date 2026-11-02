package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type fakeRows struct {
	pgx.Rows
	data [][3]string
	i    int
}

func (f *fakeRows) Next() bool { f.i++; return f.i <= len(f.data) }
func (f *fakeRows) Scan(dest ...any) error {
	row := f.data[f.i-1]
	for n := range dest {
		*(dest[n].(*string)) = row[n]
	}
	return nil
}
func (f *fakeRows) Close() {}

type pendingRow struct{ n int }

func (p pendingRow) Scan(dest ...any) error { *(dest[0].(*int)) = p.n; return nil }

type fakePushDB struct {
	subs    [][3]string
	pending int
	deleted []string
	touched []string
}

func (f *fakePushDB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return pendingRow{n: f.pending}
}
func (f *fakePushDB) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return &fakeRows{data: f.subs}, nil
}
func (f *fakePushDB) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	endpoint := args[0].(string)
	if strings.HasPrefix(sql, "delete") {
		f.deleted = append(f.deleted, endpoint)
	} else {
		f.touched = append(f.touched, endpoint)
	}
	return pgconn.CommandTag{}, nil
}

func stubSender(t *testing.T, statusByEndpoint map[string]int, sent *[]pushPayload) {
	t.Helper()
	orig := sendWebPush
	t.Cleanup(func() { sendWebPush = orig })
	sendWebPush = func(ctx context.Context, payload []byte, sub *webpush.Subscription, opts *webpush.Options) (*http.Response, error) {
		var p pushPayload
		if err := json.Unmarshal(payload, &p); err != nil {
			t.Fatalf("bad payload: %v", err)
		}
		*sent = append(*sent, p)
		return &http.Response{StatusCode: statusByEndpoint[sub.Endpoint], Body: io.NopCloser(strings.NewReader(""))}, nil
	}
}

func TestNotifyNewInboxItemSendsAndPrunesDeadSubscriptions(t *testing.T) {
	t.Setenv("VAPID_PUBLIC_KEY", "pub")
	t.Setenv("VAPID_PRIVATE_KEY", "priv")
	db := &fakePushDB{
		subs:    [][3]string{{"https://push.example/ok", "k1", "a1"}, {"https://push.example/gone", "k2", "a2"}},
		pending: 3,
	}
	var sent []pushPayload
	stubSender(t, map[string]int{"https://push.example/ok": 201, "https://push.example/gone": 410}, &sent)

	s := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil)), db: db}
	s.notifyNewInboxItem(context.Background(), "u1", "tx-9", "Kopi Kenangan", 35000)

	if len(sent) != 2 {
		t.Fatalf("want 2 pushes, got %d", len(sent))
	}
	got := sent[0]
	if got.Body != "Rp35.000 — Kopi Kenangan" || got.URL != "/inbox?id=tx-9" || got.PendingCount != 3 {
		t.Fatalf("unexpected payload: %+v", got)
	}
	if len(db.deleted) != 1 || db.deleted[0] != "https://push.example/gone" {
		t.Fatalf("want dead subscription pruned, got %v", db.deleted)
	}
	if len(db.touched) != 1 || db.touched[0] != "https://push.example/ok" {
		t.Fatalf("want live subscription touched, got %v", db.touched)
	}
}

func TestNotifyNewInboxItemSkippedWithoutVAPID(t *testing.T) {
	t.Setenv("VAPID_PUBLIC_KEY", "")
	t.Setenv("VAPID_PRIVATE_KEY", "")
	db := &fakePushDB{subs: [][3]string{{"https://push.example/ok", "k", "a"}}}
	var sent []pushPayload
	stubSender(t, nil, &sent)
	s := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil)), db: db}
	s.notifyNewInboxItem(context.Background(), "u1", "tx", "x", 1)
	if len(sent) != 0 {
		t.Fatalf("push must be disabled without VAPID keys, sent %d", len(sent))
	}
}

func TestFormatRupiah(t *testing.T) {
	cases := map[float64]string{0: "Rp0", 999: "Rp999", 1000: "Rp1.000", 35000: "Rp35.000", 1234567: "Rp1.234.567"}
	for in, want := range cases {
		if got := formatRupiah(in); got != want {
			t.Errorf("formatRupiah(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestPushSubscribeRejectsInvalidBodies(t *testing.T) {
	s := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil)), db: &fakePushDB{}}
	for name, body := range map[string]string{
		"missing keys":  `{"endpoint":"https://push.example/x"}`,
		"http endpoint": `{"endpoint":"http://push.example/x","keys":{"p256dh":"a","auth":"b"}}`,
	} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/push/subscriptions", strings.NewReader(body))
		s.handlePushSubscribe(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: want 400, got %d", name, rec.Code)
		}
	}
}

func TestPushConfigReportsEnabled(t *testing.T) {
	t.Setenv("VAPID_PUBLIC_KEY", "pub")
	t.Setenv("VAPID_PRIVATE_KEY", "priv")
	rec := httptest.NewRecorder()
	(&Server{}).handlePushConfig(rec, httptest.NewRequest(http.MethodGet, "/push/config", nil))
	var out struct {
		Enabled   bool   `json:"enabled"`
		PublicKey string `json:"public_key"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if !out.Enabled || out.PublicKey != "pub" {
		t.Fatalf("unexpected config: %+v", out)
	}
	if strings.Contains(rec.Body.String(), "priv") {
		t.Fatal("private key must never be exposed")
	}
}
