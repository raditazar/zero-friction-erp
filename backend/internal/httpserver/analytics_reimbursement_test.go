package httpserver

import (
	"fmt"
	"log/slog"
	"net/http"
	"testing"
)

func TestReimbursementPaymentIsNotPersonalIncome(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	claim := insertTx(t, pool, alice, "expense", 100_000, true)
	insertTx(t, pool, alice, "income", 500_000, false) // salary
	existing := insertTx(t, pool, alice, "income", 70_000, false)

	// Link an income already in the ledger as the payment.
	code, body := callAs(t, s, alice.ID, "POST", "/transactions/"+claim+"/link-reimbursement",
		fmt.Sprintf(`{"related_transaction_id":%q}`, existing))
	if code != http.StatusOK || body["reimbursement_status"] != "partially_reimbursed" {
		t.Fatalf("link: %d %v", code, body)
	}

	code, body = callAs(t, s, alice.ID, "GET", "/analytics/summary", ``)
	if code != http.StatusOK {
		t.Fatalf("summary: %d %v", code, body)
	}
	if body["income"].(float64) != 500_000 || body["expense"].(float64) != 0 {
		t.Fatalf("want income 500k and expense 0, got income=%v expense=%v", body["income"], body["expense"])
	}
	code, body = callAs(t, s, alice.ID, "GET", "/analytics/reimbursements", ``)
	if code != http.StatusOK || body["total_receivable"].(float64) != 30_000 || body["total_reimbursed"].(float64) != 70_000 {
		t.Fatalf("reimbursement analytics: %d %v", code, body)
	}
}
