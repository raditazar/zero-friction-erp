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

type mockDBRow struct {
	data []byte
	err  error
}

func (m mockDBRow) Scan(dest ...any) error {
	if m.err != nil {
		return m.err
	}
	if len(dest) > 0 {
		if ptr, ok := dest[0].(*json.RawMessage); ok {
			*ptr = m.data
		}
	}
	return nil
}

type mockRowQuerier struct {
	result []byte
	err    error
}

func (m *mockRowQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return mockDBRow{data: m.result, err: m.err}
}

func (m *mockRowQuerier) Ping(ctx context.Context) error {
	return nil
}

func TestWalletProviderSlug(t *testing.T) {
	t.Setenv("APP_ENV", "development")

	db := &mockRowQuerier{}
	router := NewRouter(slog.Default(), db)

	t.Run("create with provider_slug", func(t *testing.T) {
		db.result = []byte(`{"id": "00000000-0000-0000-0000-000000000002", "name": "BCA Wallet", "provider_slug": "bca"}`)
		body := []byte(`{"name": "BCA Wallet", "category": "Bank", "provider_slug": "bca"}`)
		req := httptest.NewRequest(http.MethodPost, "/wallets", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusCreated {
			t.Fatalf("expected status 201, got %d. body: %s", resp.Code, resp.Body.String())
		}
		if !strings.Contains(resp.Body.String(), `"provider_slug": "bca"`) {
			t.Fatalf("expected response to contain provider_slug bca, got %s", resp.Body.String())
		}
	})

	t.Run("create with null provider_slug", func(t *testing.T) {
		db.result = []byte(`{"id": "00000000-0000-0000-0000-000000000003", "name": "Legacy", "provider_slug": null}`)
		body := []byte(`{"name": "Legacy", "category": "Bank", "provider_slug": null}`)
		req := httptest.NewRequest(http.MethodPost, "/wallets", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusCreated {
			t.Fatalf("expected status 201, got %d. body: %s", resp.Code, resp.Body.String())
		}
		if !strings.Contains(resp.Body.String(), `"provider_slug": null`) {
			t.Fatalf("expected response to contain provider_slug null, got %s", resp.Body.String())
		}
	})

	t.Run("patch with provider_slug", func(t *testing.T) {
		db.result = []byte(`{"id": "00000000-0000-0000-0000-000000000003", "name": "Legacy", "provider_slug": "mandiri"}`)
		body := []byte(`{"provider_slug": "mandiri"}`)
		req := httptest.NewRequest(http.MethodPatch, "/wallets/00000000-0000-0000-0000-000000000003", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d. body: %s", resp.Code, resp.Body.String())
		}
		if !strings.Contains(resp.Body.String(), `"provider_slug": "mandiri"`) {
			t.Fatalf("expected response to contain provider_slug mandiri, got %s", resp.Body.String())
		}
	})
}
