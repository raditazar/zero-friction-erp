package httpserver

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestClientDBError(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		status int
		ok     bool
	}{
		{"foreign owner", &pgconn.PgError{Code: "ZF403", ColumnName: "wallet_id"}, http.StatusBadRequest, true},
		{"missing reference", &pgconn.PgError{Code: "23503"}, http.StatusBadRequest, true},
		{"check constraint", &pgconn.PgError{Code: "23514", ConstraintName: "transactions_amount_positive"}, http.StatusBadRequest, true},
		{"unique", &pgconn.PgError{Code: "23505"}, http.StatusConflict, true},
		{"bad uuid", &pgconn.PgError{Code: "22P02"}, http.StatusBadRequest, true},
		{"wrapped", fmt.Errorf("insert: %w", &pgconn.PgError{Code: "ZF403"}), http.StatusBadRequest, true},
		{"server side", &pgconn.PgError{Code: "53300"}, 0, false},
		{"not postgres", fmt.Errorf("boom"), 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, message, ok := clientDBError(tc.err)
			if ok != tc.ok || status != tc.status {
				t.Fatalf("got (%d, %q, %v), want (%d, _, %v)", status, message, ok, tc.status, tc.ok)
			}
		})
	}
	_, message, _ := clientDBError(&pgconn.PgError{Code: "ZF403", ColumnName: "wallet_id"})
	if !strings.Contains(message, "wallet_id") {
		t.Fatalf("message should name the column, got %q", message)
	}
}
