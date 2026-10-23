package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

type mockAndroidRow struct {
	values []any
	err    error
}

func (r mockAndroidRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	for i, d := range dest {
		if i >= len(r.values) {
			break
		}
		val := r.values[i]
		switch ptr := d.(type) {
		case *string:
			if s, ok := val.(string); ok {
				*ptr = s
			}
		case *json.RawMessage:
			if b, ok := val.([]byte); ok {
				*ptr = b
			} else if s, ok := val.(string); ok {
				*ptr = []byte(s)
			}
		}
	}
	return nil
}

type mockAndroidDB struct {
	queryFn func(ctx context.Context, sql string, args ...any) pgx.Row
}

func (m *mockAndroidDB) Ping(ctx context.Context) error {
	return nil
}

func (m *mockAndroidDB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryFn != nil {
		return m.queryFn(ctx, sql, args...)
	}
	return mockAndroidRow{err: pgx.ErrNoRows}
}

func defaultMockDB() *mockAndroidDB {
	return &mockAndroidDB{
		queryFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			lowerSQL := strings.ToLower(sql)
			if strings.Contains(lowerSQL, "webhook_tokens") {
				return mockAndroidRow{values: []any{"00000000-0000-0000-0000-000000000001", "android"}}
			}
			if strings.Contains(lowerSQL, "auth_sessions") {
				return mockAndroidRow{values: []any{"00000000-0000-0000-0000-000000000001"}}
			}
			if strings.Contains(lowerSQL, "insert into device_registrations") {
				return mockAndroidRow{values: []any{"dev-1"}}
			}
			if strings.Contains(lowerSQL, "from device_registrations") {
				return mockAndroidRow{values: []any{`[{"id":"dev-1","device_id":"phone-1","platform":"android","events_count":1}]`}}
			}
			if strings.Contains(lowerSQL, "from wallets") {
				return mockAndroidRow{values: []any{"00000000-0000-0000-0000-000000000002", "GoPay Wallet"}}
			}
			if strings.Contains(lowerSQL, "from categories") {
				return mockAndroidRow{values: []any{"00000000-0000-0000-0000-000000000003"}}
			}
			if strings.Contains(lowerSQL, "insert into transactions") {
				return mockAndroidRow{values: []any{`{"id":"00000000-0000-0000-0000-000000000099","amount":35000,"status":"needs_review"}`}}
			}
			if strings.Contains(lowerSQL, "insert into webhook_events") {
				return mockAndroidRow{values: []any{"00000000-0000-0000-0000-000000000088"}}
			}
			if strings.Contains(lowerSQL, "update transactions") {
				return mockAndroidRow{values: []any{"00000000-0000-0000-0000-000000000099"}}
			}
			return mockAndroidRow{err: pgx.ErrNoRows}
		},
	}
}

func TestAndroidNotificationRequiresAuth(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	router := NewRouter(slog.Default(), nil)

	body := []byte(`{"app_name":"GoPay","text":"Kamu berhasil bayar Rp35.000 ke Kopi Kenangan"}`)
	req := httptest.NewRequest(http.MethodPost, "/integrations/android/notifications", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized, got %d", resp.Code)
	}
}

func TestAndroidDevicesRequiresAuth(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	router := NewRouter(slog.Default(), nil)

	req := httptest.NewRequest(http.MethodGet, "/integrations/android/devices", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized, got %d", resp.Code)
	}
}

func TestAndroidTestPushReturnsDiagnostics(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	db := defaultMockDB()
	router := NewRouter(slog.Default(), db)

	body := []byte(`{
		"app_name": "GoPay",
		"package_name": "com.gojek.app",
		"title": "Pembayaran Berhasil",
		"text": "Kamu berhasil bayar Rp35.000 ke Kopi Kenangan",
		"device_id": "test-phone"
	}`)

	req := httptest.NewRequest(http.MethodPost, "/integrations/android/test-push?token=zfe_wh_testtoken", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d. body: %s", resp.Code, resp.Body.String())
	}

	var res map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if res["status"] != "test_success" {
		t.Fatalf("expected status 'test_success', got %v", res["status"])
	}

	parsed, ok := res["parsed"].(map[string]any)
	if !ok || parsed["amount"] != float64(35000) || parsed["merchant"] != "Kopi Kenangan" {
		t.Fatalf("unexpected parsed result: %+v", res["parsed"])
	}
}

func TestAndroidNotificationAcceptsTransaction(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	db := defaultMockDB()
	router := NewRouter(slog.Default(), db)

	body := []byte(`{
		"app_name": "GoPay",
		"package_name": "com.gojek.app",
		"title": "Pembayaran Berhasil",
		"text": "Kamu berhasil bayar Rp35.000 ke Kopi Kenangan",
		"device_id": "test-phone"
	}`)

	req := httptest.NewRequest(http.MethodPost, "/integrations/android/notifications?token=zfe_wh_testtoken", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusAccepted {
		t.Fatalf("expected status 202 Accepted, got %d. body: %s", resp.Code, resp.Body.String())
	}

	var res map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["status"] != "accepted" {
		t.Fatalf("expected status 'accepted', got %v", res["status"])
	}
}

func TestAndroidNotificationFiltersPromo(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	db := defaultMockDB()
	router := NewRouter(slog.Default(), db)

	body := []byte(`{
		"app_name": "GoPay",
		"package_name": "com.gojek.app",
		"title": "Diskon 50% Buat Kamu!",
		"text": "Gunakan kode promo HEMAT50 untuk pesanan makananmu hari ini",
		"device_id": "test-phone"
	}`)

	req := httptest.NewRequest(http.MethodPost, "/integrations/android/notifications?token=zfe_wh_testtoken", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d. body: %s", resp.Code, resp.Body.String())
	}

	var res map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["status"] != "filtered" {
		t.Fatalf("expected status 'filtered', got %v", res["status"])
	}
}

func TestAndroidNotificationLayer1Drop(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	db := defaultMockDB()
	baseQuery := db.queryFn
	db.queryFn = func(ctx context.Context, sql string, args ...any) pgx.Row {
		if strings.Contains(sql, "dedup_hash = $2") {
			return mockAndroidRow{values: []any{"existing-tx-id"}}
		}
		return baseQuery(ctx, sql, args...)
	}

	router := NewRouter(slog.Default(), db)

	body := []byte(`{
		"app_name": "GoPay",
		"package_name": "com.gojek.app",
		"title": "Pembayaran Berhasil",
		"text": "Kamu berhasil bayar Rp35.000 ke Kopi Kenangan",
		"device_id": "test-phone"
	}`)

	req := httptest.NewRequest(http.MethodPost, "/integrations/android/notifications?token=zfe_wh_testtoken", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d. body: %s", resp.Code, resp.Body.String())
	}

	var res map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["status"] != "duplicate_dropped" {
		t.Fatalf("expected status 'duplicate_dropped', got %v", res["status"])
	}
	if res["duplicate_of"] != "existing-tx-id" {
		t.Fatalf("expected duplicate_of 'existing-tx-id', got %v", res["duplicate_of"])
	}
}

func TestAndroidNotificationLayer2Merge(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	db := defaultMockDB()
	baseQuery := db.queryFn
	db.queryFn = func(ctx context.Context, sql string, args ...any) pgx.Row {
		if strings.Contains(sql, "raw_input like '%'") {
			return mockAndroidRow{values: []any{"existing-ref-tx-id"}}
		}
		return baseQuery(ctx, sql, args...)
	}

	router := NewRouter(slog.Default(), db)

	body := []byte(`{
		"app_name": "OCTO Mobile",
		"package_name": "com.cimb.octo",
		"title": "Transfer Berhasil",
		"text": "Transfer berhasil ke 1234567890 Rp500.000 Ref: CIMB-998877",
		"device_id": "test-phone"
	}`)

	req := httptest.NewRequest(http.MethodPost, "/integrations/android/notifications?token=zfe_wh_testtoken", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d. body: %s", resp.Code, resp.Body.String())
	}

	var res map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["status"] != "duplicate_merged" {
		t.Fatalf("expected status 'duplicate_merged', got %v", res["status"])
	}
	if res["duplicate_of"] != "existing-ref-tx-id" {
		t.Fatalf("expected duplicate_of 'existing-ref-tx-id', got %v", res["duplicate_of"])
	}
}

func TestAndroidDevicesList(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	db := defaultMockDB()
	router := NewRouter(slog.Default(), db)

	req := httptest.NewRequest(http.MethodGet, "/integrations/android/devices", nil)
	req.AddCookie(&http.Cookie{Name: "zfe_session", Value: "valid-session"})
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d. body: %s", resp.Code, resp.Body.String())
	}

	if !strings.Contains(resp.Body.String(), "phone-1") {
		t.Fatalf("expected body to contain 'phone-1', got: %s", resp.Body.String())
	}
}
