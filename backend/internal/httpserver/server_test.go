package httpserver

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeDB struct {
	err error
}

func (db fakeDB) Ping(context.Context) error {
	return db.err
}

func TestHealthz(t *testing.T) {
	router := NewRouter(slog.Default(), fakeDB{})
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
}

func TestHeatlhzAlias(t *testing.T) {
	router := NewRouter(slog.Default(), fakeDB{})
	request := httptest.NewRequest(http.MethodGet, "/heatlhz", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
}

func TestReadyzUnavailableWhenDatabasePingFails(t *testing.T) {
	router := NewRouter(slog.Default(), fakeDB{err: errors.New("database unavailable")})
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, response.Code)
	}
}

func TestHealthzUnavailableWhenDatabasePingFails(t *testing.T) {
	router := NewRouter(slog.Default(), fakeDB{err: errors.New("database unavailable")})
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
}

func TestTransactionWebhookRequiresAuth(t *testing.T) {
	router := NewRouter(slog.Default(), nil)
	request := httptest.NewRequest(http.MethodPost, "/webhook/transactions", bytes.NewBufferString(`{"rawText":"20k parkir stasiun"}`))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestExtendedResourceRequiresAuth(t *testing.T) {
	router := NewRouter(slog.Default(), nil)
	request := httptest.NewRequest(http.MethodGet, "/saving-goals", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestDevelopmentRequiresAuthentication(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	router := NewRouter(slog.Default(), nil)
	request := httptest.NewRequest(http.MethodGet, "/saving-goals", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestAICategorizeTransactionRequiresAuthentication(t *testing.T) {
	router := NewRouter(slog.Default(), nil)
	request := httptest.NewRequest(http.MethodPost, "/ai/categorize-transaction", bytes.NewBufferString(`{"text":"kopi pagi 25000"}`))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func TestQueryTokenAuthenticationRejectsInvalidToken(t *testing.T) {
	router := NewRouter(slog.Default(), nil)

	// User protected endpoint with invalid query token
	req1 := httptest.NewRequest(http.MethodGet, "/saving-goals?token=invalid_token", nil)
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d for invalid user query token, got %d", http.StatusUnauthorized, rec1.Code)
	}

	// Webhook endpoint with invalid query token
	req2 := httptest.NewRequest(http.MethodPost, "/webhook/transactions?token=invalid_token", bytes.NewBufferString(`{"rawText":"20k parkir"}`))
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d for invalid webhook query token, got %d", http.StatusUnauthorized, rec2.Code)
	}
}

func TestVersion(t *testing.T) {
	router := NewRouter(slog.Default(), nil)
	request := httptest.NewRequest(http.MethodGet, "/version", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
}

func TestRegisteredStubEndpoints(t *testing.T) {
	router := NewRouter(slog.Default(), nil)

	for _, endpoint := range endpoints() {
		t.Run(endpoint.Method+" "+endpoint.Pattern, func(t *testing.T) {
			path := endpoint.Pattern
			for _, param := range endpoint.Params {
				path = strings.ReplaceAll(path, "{"+param+"}", "00000000-0000-0000-0000-000000000001")
			}

			request := httptest.NewRequest(endpoint.Method, path, nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusNotImplemented {
				t.Fatalf("expected status %d, got %d", http.StatusNotImplemented, response.Code)
			}
		})
	}
}
