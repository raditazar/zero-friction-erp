package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

type tokenListDB struct {
	sql     string
	args    []any
	payload json.RawMessage
}

func (db *tokenListDB) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	db.sql = sql
	db.args = args
	return tokenListRow{payload: db.payload}
}

type tokenListRow struct {
	payload json.RawMessage
}

func (row tokenListRow) Scan(dest ...any) error {
	*(dest[0].(*json.RawMessage)) = row.payload
	return nil
}

func TestTokenListsSupportRevokedHistoryAndNewestFirst(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		handler      func(*Server, http.ResponseWriter, *http.Request)
		table        string
		alias        string
		wantIncluded bool
	}{
		{name: "api keys default", path: "/api-keys", handler: (*Server).handleListAPIKeys, table: "api_keys", alias: "k"},
		{name: "api keys include revoked", path: "/api-keys?include_revoked=true", handler: (*Server).handleListAPIKeys, table: "api_keys", alias: "k", wantIncluded: true},
		{name: "webhook tokens default", path: "/webhook-tokens", handler: (*Server).handleListWebhookTokens, table: "webhook_tokens", alias: "t"},
		{name: "webhook tokens include revoked", path: "/webhook-tokens?include_revoked=true", handler: (*Server).handleListWebhookTokens, table: "webhook_tokens", alias: "t", wantIncluded: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := &tokenListDB{payload: json.RawMessage(`[{"id":"newest"},{"id":"oldest"}]`)}
			server := &Server{db: db}
			request := httptest.NewRequest(http.MethodGet, tt.path, nil)
			response := httptest.NewRecorder()

			tt.handler(server, response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
			}
			if response.Body.String() != "[{\"id\":\"newest\"},{\"id\":\"oldest\"}]" {
				t.Fatalf("expected newest-first payload, got %s", response.Body.String())
			}
			if !strings.Contains(db.sql, "from "+tt.table+" "+tt.alias) {
				t.Fatalf("expected query for %s, got %s", tt.table, db.sql)
			}
			if !strings.Contains(db.sql, "order by "+tt.alias+".created_at desc") {
				t.Fatalf("expected newest-first SQL ordering, got %s", db.sql)
			}
			if !strings.Contains(db.sql, "($2::boolean or "+tt.alias+".deleted_at is null)") {
				t.Fatalf("expected default revoked-token filter, got %s", db.sql)
			}
			if len(db.args) != 2 {
				t.Fatalf("expected user and include-revoked arguments, got %#v", db.args)
			}
			if got, ok := db.args[1].(bool); !ok || got != tt.wantIncluded {
				t.Fatalf("expected include_revoked=%t, got %#v", tt.wantIncluded, db.args[1])
			}
		})
	}
}
