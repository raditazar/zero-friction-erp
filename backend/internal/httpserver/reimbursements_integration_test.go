package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// callAs runs one request through the API router as the given user and decodes the JSON body.
func callAs(t *testing.T, s *Server, user, method, path, body string) (int, map[string]any) {
	t.Helper()
	mux := http.NewServeMux()
	s.registerResources(mux)
	s.registerExtendedResources(mux)
	s.registerAIAndAnalytics(mux)
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, user)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	out := map[string]any{}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func insertTx(t *testing.T, pool *pgxpool.Pool, u testUser, txType string, amount int, claim bool) string {
	t.Helper()
	status := "none"
	if claim {
		status = "receivable"
	}
	var id string
	if err := pool.QueryRow(context.Background(), `
		insert into transactions (user_id, wallet_id, type, status, transaction_at, merchant, amount, is_reimbursement, reimbursement_status)
		values ($1, $2, $3::transaction_type, 'approved', now(), 'Hotel', $4, $5, $6::reimbursement_status)
		returning id::text
	`, u.ID, u.WalletID, txType, amount, claim, status).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func claimRow(t *testing.T, pool *pgxpool.Pool, id string) (status string, received, outstanding float64) {
	t.Helper()
	if err := pool.QueryRow(context.Background(), `
		select status::text, received::float8, outstanding::float8 from reimbursement_claims where id = $1
	`, id).Scan(&status, &received, &outstanding); err != nil {
		t.Fatal(err)
	}
	return
}

func TestReimbursementPartialThenFullPayment(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 1_000_000)
	claim := insertTx(t, pool, alice, "expense", 100_000, true)

	code, body := callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/settle-reimbursement",
		fmt.Sprintf(`{"wallet_id":%q,"amount":60000}`, alice.WalletID))
	if code != http.StatusOK {
		t.Fatalf("partial settle: %d %v", code, body)
	}
	if status, received, outstanding := claimRow(t, pool, claim); status != "partially_reimbursed" || received != 60_000 || outstanding != 40_000 {
		t.Fatalf("after 60k: %s received=%v outstanding=%v", status, received, outstanding)
	}
	if body["reimbursement_status"] != "partially_reimbursed" || body["outstanding"].(float64) != 40_000 {
		t.Fatalf("response not refreshed: %v", body)
	}

	// No amount: pays exactly what is left.
	code, body = callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/settle-reimbursement",
		fmt.Sprintf(`{"wallet_id":%q}`, alice.WalletID))
	if code != http.StatusOK {
		t.Fatalf("final settle: %d %v", code, body)
	}
	if status, received, outstanding := claimRow(t, pool, claim); status != "reimbursed" || received != 100_000 || outstanding != 0 {
		t.Fatalf("after rest: %s received=%v outstanding=%v", status, received, outstanding)
	}
	if got := walletBalance(t, pool, alice.WalletID); got != 1_000_000 {
		t.Fatalf("claim fully paid back should leave the wallet unchanged, got %v", got)
	}

	// Deleting a payment reopens the claim.
	var paymentID string
	if err := pool.QueryRow(context.Background(), `
		select id::text from transactions where related_transaction_id = $1 order by amount limit 1
	`, claim).Scan(&paymentID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(context.Background(), `update transactions set deleted_at = now() where id = $1`, paymentID); err != nil {
		t.Fatal(err)
	}
	if status, _, outstanding := claimRow(t, pool, claim); status != "partially_reimbursed" || outstanding != 40_000 {
		t.Fatalf("after deleting the 40k payment: %s outstanding=%v", status, outstanding)
	}
}

func TestReimbursementSettleRejectsNonClaim(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	bob := seedUser(t, pool, "bob@example.invalid", 0)
	plain := insertTx(t, pool, alice, "expense", 50_000, false)
	claim := insertTx(t, pool, alice, "expense", 50_000, true)

	if code, body := callAs(t, s, alice.ID, "POST", "/transactions/"+plain+"/settle-reimbursement", `{}`); code != http.StatusBadRequest {
		t.Fatalf("settle on a plain expense: want 400, got %d %v", code, body)
	}
	if code, _ := callAs(t, s, bob.ID, "POST", "/transactions/"+claim+"/settle-reimbursement", `{}`); code != http.StatusNotFound {
		t.Fatalf("another user's claim: want 404, got %d", code)
	}
	// Bob cannot pay Alice's claim into his wallet either.
	if code, _ := callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/settle-reimbursement",
		fmt.Sprintf(`{"wallet_id":%q}`, bob.WalletID)); code != http.StatusBadRequest {
		t.Fatalf("payment into another user's wallet: want 400, got %d", code)
	}
	income := insertTx(t, pool, alice, "income", 10_000, false)
	if code, _ := callAs(t, s, alice.ID, "POST", "/transactions/"+income+"/mark-reimbursement", ``); code != http.StatusBadRequest {
		t.Fatalf("mark an income as claim: want 400, got %d", code)
	}
}

func TestReimbursementCloseIgnoreReopen(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	claim := insertTx(t, pool, alice, "expense", 80_000, true)

	// Settle without a wallet closes the claim without recording money.
	if code, body := callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/settle-reimbursement", ``); code != http.StatusOK {
		t.Fatalf("close: %d %v", code, body)
	}
	if status, received, outstanding := claimRow(t, pool, claim); status != "reimbursed" || received != 0 || outstanding != 0 {
		t.Fatalf("closed: %s %v %v", status, received, outstanding)
	}
	// A PATCH sending a stale status cannot reopen it.
	if code, _ := callAs(t, s, alice.ID, "PATCH", "/transactions/"+claim, `{"is_reimbursement":true,"reimbursement_status":"receivable"}`); code != http.StatusOK {
		t.Fatalf("patch: %d", code)
	}
	if status, _, _ := claimRow(t, pool, claim); status != "reimbursed" {
		t.Fatalf("patch overrode derived status: %s", status)
	}

	if code, _ := callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/ignore-reimbursement", ``); code != http.StatusOK {
		t.Fatal("ignore failed")
	}
	if status, _, outstanding := claimRow(t, pool, claim); status != "ignored" || outstanding != 0 {
		t.Fatalf("ignored: %s %v", status, outstanding)
	}
	if code, _ := callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/settle-reimbursement", ``); code != http.StatusBadRequest {
		t.Fatalf("settle an ignored claim: want 400, got %d", code)
	}
	if code, _ := callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/reopen-reimbursement", ``); code != http.StatusOK {
		t.Fatal("reopen failed")
	}
	if status, _, outstanding := claimRow(t, pool, claim); status != "receivable" || outstanding != 80_000 {
		t.Fatalf("reopened: %s %v", status, outstanding)
	}
}

func TestMigrationFlipsLegacyReimbursementLinks(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	claim := insertTx(t, pool, alice, "expense", 100_000, true)
	income := insertTx(t, pool, alice, "income", 100_000, false)
	closed := insertTx(t, pool, alice, "expense", 20_000, true)

	// Old shape: the claim points at its payment and the status was set by hand.
	if _, err := pool.Exec(ctx, `
		alter table transactions disable trigger transactions_sync_reimbursement;
		update transactions set related_transaction_id = $2, reimbursement_status = 'partially_reimbursed' where id = $1;
		update transactions set reimbursement_status = 'reimbursed' where id = $3;
		update transactions set reimbursement_settled_at = null;
		alter table transactions enable trigger transactions_sync_reimbursement;
	`, claim, income, closed); err != nil {
		t.Fatal(err)
	}
	b, err := readMigration("016_reimbursement_claims.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, b); err != nil {
		t.Fatal(err)
	}
	var claimLink, incomeLink *string
	if err := pool.QueryRow(ctx, `select related_transaction_id::text from transactions where id = $1`, claim).Scan(&claimLink); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `select related_transaction_id::text from transactions where id = $1`, income).Scan(&incomeLink); err != nil {
		t.Fatal(err)
	}
	if claimLink != nil || incomeLink == nil || *incomeLink != claim {
		t.Fatalf("link not flipped: claim=%v income=%v", claimLink, incomeLink)
	}
	if status, received, _ := claimRow(t, pool, claim); status != "reimbursed" || received != 100_000 {
		t.Fatalf("flipped claim: %s %v", status, received)
	}
	if status, _, _ := claimRow(t, pool, closed); status != "reimbursed" {
		t.Fatalf("hand-closed claim reopened by migration: %s", status)
	}
}
