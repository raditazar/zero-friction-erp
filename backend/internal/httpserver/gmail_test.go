package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

type gmailNoAuthDB struct{}

func (gmailNoAuthDB) Ping(context.Context) error                       { return nil }
func (gmailNoAuthDB) QueryRow(context.Context, string, ...any) pgx.Row { return gmailErrorRow{} }

type gmailErrorRow struct{}

func (gmailErrorRow) Scan(...any) error { return errors.New("invalid") }

func TestGmailNeverUsesDevelopmentFallback(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	router := NewRouter(slog.Default(), gmailNoAuthDB{})
	for _, path := range []string{"status", "messages", "connect", "callback", "settings", "preview", "import", "sync", "connection"} {
		method := "GET"
		if path == "settings" {
			method = "PUT"
		}
		if path == "preview" || path == "import" || path == "sync" {
			method = "POST"
		}
		if path == "connection" {
			method = "DELETE"
		}
		r := httptest.NewRequest(method, "/integrations/gmail/"+path, strings.NewReader(`{}`))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		if w.Code != 401 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
}
func TestGmailMachineRoutesRejectForgedJWT(t *testing.T) {
	t.Setenv("GMAIL_PUSH_AUDIENCE", "https://example.invalid/integrations/gmail/push")
	t.Setenv("GMAIL_PUSH_SERVICE_ACCOUNT", "push@example.invalid")
	t.Setenv("GMAIL_MAINTENANCE_AUDIENCE", "https://example.invalid/integrations/gmail/maintenance")
	t.Setenv("GMAIL_MAINTENANCE_SERVICE_ACCOUNT", "scheduler@example.invalid")
	router := NewRouter(slog.Default(), gmailNoAuthDB{})
	for _, path := range []string{"push", "maintenance"} {
		for _, token := range []string{"", "not-a-jwt"} {
			r := httptest.NewRequest("POST", "/integrations/gmail/"+path, strings.NewReader(`{}`))
			r.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, r)
			if w.Code != http.StatusUnauthorized {
				t.Fatalf("%s: %d", path, w.Code)
			}
		}
	}
}
