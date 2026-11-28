package httpserver

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func reconcileCount(t *testing.T, pool *pgxpool.Pool, walletID string) (rows, txs int) {
	t.Helper()
	if err := pool.QueryRow(context.Background(), `
		select count(*), count(transaction_id) from wallet_reconciliations where wallet_id = $1
	`, walletID).Scan(&rows, &txs); err != nil {
		t.Fatal(err)
	}
	return
}

func summaryNumbers(t *testing.T, s *Server, user string) (income, expense float64) {
	t.Helper()
	code, body := callAs(t, s, user, "GET", "/analytics/summary", ``)
	if code != http.StatusOK {
		t.Fatalf("summary: %d %v", code, body)
	}
	return body["income"].(float64), body["expense"].(float64)
}

func TestReconcileLowersBalanceWithoutTouchingReports(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 1_000_000)
	insertTx(t, pool, alice, "expense", 100_000, false)
	income0, expense0 := summaryNumbers(t, s, alice.ID)

	code, body := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile", `{"actual_balance":845000}`)
	if code != http.StatusOK {
		t.Fatalf("reconcile: %d %v", code, body)
	}
	if got := walletBalance(t, pool, alice.WalletID); got != 845_000 {
		t.Fatalf("balance after reconcile: %v", got)
	}
	if body["balance"].(float64) != 845_000 {
		t.Fatalf("response balance: %v", body["balance"])
	}
	tx := body["transaction"].(map[string]any)
	if tx["type"] != "adjustment" || tx["amount"].(float64) != -55_000 {
		t.Fatalf("want a -55k adjustment, got %v", tx)
	}
	rec := body["reconciliation"].(map[string]any)
	if rec["resolution"] != "adjustment" || rec["difference"].(float64) != -55_000 || rec["app_balance"].(float64) != 900_000 {
		t.Fatalf("reconciliation row: %v", rec)
	}
	if income, expense := summaryNumbers(t, s, alice.ID); income != income0 || expense != expense0 {
		t.Fatalf("adjustment leaked into reports: income %v->%v expense %v->%v", income0, income, expense0, expense)
	}
}

func TestReconcileRaisesBalance(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 100_000)
	if code, body := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile", `{"actual_balance":130000.5}`); code != http.StatusOK {
		t.Fatalf("reconcile: %d %v", code, body)
	}
	if got := walletBalance(t, pool, alice.WalletID); got != 130_000.5 {
		t.Fatalf("balance: %v", got)
	}
}

func TestReconcileAsOrdinaryExpenseCountsInReports(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 500_000)
	var categoryID string
	if err := pool.QueryRow(context.Background(), `
		insert into categories (user_id, name, type) values ($1, 'Makan', 'expense') returning id::text
	`, alice.ID).Scan(&categoryID); err != nil {
		t.Fatal(err)
	}

	code, body := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile",
		fmt.Sprintf(`{"actual_balance":480000,"resolution":"transaction","category_id":%q}`, categoryID))
	if code != http.StatusOK {
		t.Fatalf("reconcile: %d %v", code, body)
	}
	tx := body["transaction"].(map[string]any)
	if tx["type"] != "expense" || tx["amount"].(float64) != 20_000 || tx["category_id"] != categoryID {
		t.Fatalf("want a categorised 20k expense, got %v", tx)
	}
	if _, expense := summaryNumbers(t, s, alice.ID); expense != 20_000 {
		t.Fatalf("expense should count in reports, got %v", expense)
	}
	if got := walletBalance(t, pool, alice.WalletID); got != 480_000 {
		t.Fatalf("balance: %v", got)
	}
}

func TestReconcileMatchedRecordsCheckOnly(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 250_000)

	for i := 0; i < 2; i++ { // a double tap books nothing twice
		code, body := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile", `{"actual_balance":250000}`)
		if code != http.StatusOK || body["transaction"] != nil || body["reconciliation"].(map[string]any)["resolution"] != "matched" {
			t.Fatalf("matched: %d %v", code, body)
		}
	}
	if rows, txs := reconcileCount(t, pool, alice.WalletID); rows != 2 || txs != 0 {
		t.Fatalf("want 2 checks and no transaction, got %d/%d", rows, txs)
	}

	code, preview := callAs(t, s, alice.ID, "GET", "/wallets/"+alice.WalletID+"/reconcile-preview", ``)
	if code != http.StatusOK || preview["app_balance"].(float64) != 250_000 || preview["last_reconciled"] == nil {
		t.Fatalf("preview: %d %v", code, preview)
	}
}

func TestReconcileAsOfPastDate(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 1_000_000)
	ctx := context.Background()
	// An expense ten days ago and one yesterday.
	for _, row := range []struct {
		days   int
		amount int
	}{{10, 100_000}, {1, 50_000}} {
		if _, err := pool.Exec(ctx, `
			insert into transactions (user_id, wallet_id, type, status, transaction_at, amount)
			values ($1, $2, 'expense', 'approved', now() - make_interval(days => $3), $4)
		`, alice.ID, alice.WalletID, row.days, row.amount); err != nil {
			t.Fatal(err)
		}
	}
	// The bank statement five days ago said 880k; the app had 900k then.
	asOf := time.Now().AddDate(0, 0, -5).UTC().Format(time.RFC3339)
	code, preview := callAs(t, s, alice.ID, "GET", "/wallets/"+alice.WalletID+"/reconcile-preview?as_of="+asOf, ``)
	if code != http.StatusOK || preview["app_balance"].(float64) != 900_000 {
		t.Fatalf("preview as of 5 days ago: %d %v", code, preview)
	}
	code, body := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile",
		fmt.Sprintf(`{"actual_balance":880000,"as_of":%q}`, asOf))
	if code != http.StatusOK {
		t.Fatalf("reconcile: %d %v", code, body)
	}
	// Yesterday's expense still counts after the dated adjustment.
	if got := walletBalance(t, pool, alice.WalletID); got != 830_000 {
		t.Fatalf("balance now: want 830k, got %v", got)
	}

	future := time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339)
	if code, _ := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile",
		fmt.Sprintf(`{"actual_balance":1,"as_of":%q}`, future)); code != http.StatusBadRequest {
		t.Fatalf("future as_of: want 400, got %d", code)
	}
}

func TestReconcileStaysWithOwner(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 100_000)
	bob := seedUser(t, pool, "bob@example.invalid", 0)

	if code, _ := callAs(t, s, bob.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile", `{"actual_balance":0}`); code != http.StatusNotFound {
		t.Fatalf("reconcile another user's wallet: want 404, got %d", code)
	}
	if code, _ := callAs(t, s, bob.ID, "GET", "/wallets/"+alice.WalletID+"/reconcile-preview", ``); code != http.StatusNotFound {
		t.Fatalf("preview another user's wallet: want 404, got %d", code)
	}
	var bobCategory string
	if err := pool.QueryRow(context.Background(), `
		insert into categories (user_id, name, type) values ($1, 'Lain', 'expense') returning id::text
	`, bob.ID).Scan(&bobCategory); err != nil {
		t.Fatal(err)
	}
	if code, _ := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile",
		fmt.Sprintf(`{"actual_balance":90000,"resolution":"transaction","category_id":%q}`, bobCategory)); code != http.StatusBadRequest {
		t.Fatalf("another user's category: want 400, got %d", code)
	}
	if got := walletBalance(t, pool, alice.WalletID); got != 100_000 {
		t.Fatalf("refused reconcile changed the balance: %v", got)
	}
	if code, _ := callAs(t, s, alice.ID, "POST", "/wallets/"+alice.WalletID+"/reconcile", `{}`); code != http.StatusBadRequest {
		t.Fatalf("missing actual_balance: want 400, got %d", code)
	}
}

func TestNegativeAmountOnlyForAdjustments(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	code, _ := callAs(t, s, alice.ID, "POST", "/transactions",
		fmt.Sprintf(`{"wallet_id":%q,"type":"expense","amount":-5000}`, alice.WalletID))
	if code != http.StatusBadRequest {
		t.Fatalf("negative expense: want 400, got %d", code)
	}
}
