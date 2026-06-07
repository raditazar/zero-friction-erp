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

func TestDevelopmentFallbackReachesProtectedHandler(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	router := NewRouter(slog.Default(), nil)
	request := httptest.NewRequest(http.MethodGet, "/saving-goals", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, response.Code)
	}
}

func TestAICategorizeTransactionUsesRuleBasedFirst(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	router := NewRouter(slog.Default(), nil)
	request := httptest.NewRequest(http.MethodPost, "/ai/categorize-transaction", bytes.NewBufferString(`{"text":"kopi pagi 25000"}`))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	if !strings.Contains(response.Body.String(), `"strategy":"rule_based"`) {
		t.Fatalf("expected rule_based response, got %s", response.Body.String())
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
