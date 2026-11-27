package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"zero-friction-erp/backend/internal/postgres"
)

func asUser(r *http.Request, uid string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), userIDContextKey, uid))
}

func categoryID(t *testing.T, s *Server, uid, name string) string {
	t.Helper()
	var id string
	if err := s.db.QueryRow(context.Background(), `
		insert into categories(user_id, name, type) values ($1, $2, 'expense') returning id::text
	`, uid, name).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestMonthBoundariesFollowTheUsersTimezone(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "tz@example.invalid", 0)
	food := categoryID(t, s, u.ID, "Makan")

	// 2026-11-30 18:30 UTC is 2026-12-01 01:30 in Jakarta.
	if _, err := pool.Exec(ctx, `
		insert into transactions(user_id, wallet_id, category_id, type, status, transaction_at, amount)
		values ($1, $2, $3, 'expense', 'approved', '2026-11-30T18:30:00Z', 25000)
	`, u.ID, u.WalletID, food); err != nil {
		t.Fatal(err)
	}

	repo := postgres.NewBudgetRepository(pool)
	for _, period := range []string{"2026-11", "2026-12"} {
		if err := repo.UpsertAllocations(ctx, u.ID, period, []postgres.CategoryAllocation{{CategoryID: food, AllocatedAmount: 100000}}); err != nil {
			t.Fatal(err)
		}
	}
	spentIn := func(period string) float64 {
		t.Helper()
		start, end, err := monthBounds(period, s.userLocation(ctx, u.ID))
		if err != nil {
			t.Fatal(err)
		}
		budget, err := repo.GetMonthlyBudget(ctx, u.ID, period, start, end)
		if err != nil {
			t.Fatal(err)
		}
		return budget.Allocations[0].SpentAmount
	}
	if got := spentIn("2026-11"); got != 0 {
		t.Fatalf("November spent = %v, want 0 (the expense is on 1 December in Jakarta)", got)
	}
	if got := spentIn("2026-12"); got != 25000 {
		t.Fatalf("December spent = %v, want 25000", got)
	}

	// The ledger filter reads dates in the same timezone.
	rec := httptest.NewRecorder()
	s.handleListTransactions(rec, asUser(httptest.NewRequest(http.MethodGet, "/transactions?from=2026-12-01&to=2026-12-01", nil), u.ID))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"total": 1`) && !strings.Contains(rec.Body.String(), `"total":1`) {
		t.Fatalf("ledger for 1 December: %d %s", rec.Code, rec.Body.String())
	}

	// A user in UTC sees it in November instead.
	if _, err := pool.Exec(ctx, `insert into profiles(id, timezone) values ($1, 'UTC')`, u.ID); err != nil {
		t.Fatal(err)
	}
	if got := spentIn("2026-11"); got != 25000 {
		t.Fatalf("November spent in UTC = %v, want 25000", got)
	}
}

func TestTransferAdminFeeCountsAsSpending(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "fee@example.invalid", 1000000)
	var savings string
	if err := pool.QueryRow(ctx, `
		insert into wallets(user_id, name, category, currency, init_balance)
		values ($1, 'Tabungan', 'bank', 'IDR', 0) returning id::text
	`, u.ID).Scan(&savings); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		insert into transactions(user_id, wallet_id, destination_wallet_id, type, status, transaction_at, amount, admin_fee)
		values ($1, $2, $3, 'transfer', 'approved', '2026-11-10T03:00:00Z', 200000, 6500)
	`, u.ID, u.WalletID, savings); err != nil {
		t.Fatal(err)
	}

	// Balances are unchanged by the new reporting: the fee still leaves the source wallet once.
	if got := walletBalance(t, pool, u.WalletID); got != 793500 {
		t.Fatalf("source balance = %v, want 793500", got)
	}

	rec := httptest.NewRecorder()
	s.handleAnalyticsSpendingByCategory(rec, asUser(httptest.NewRequest(http.MethodGet, "/analytics/spending-by-category?from=2026-11-01&to=2026-11-30", nil), u.ID))
	var rows []struct {
		Name   string  `json:"name"`
		Amount float64 `json:"amount"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
	if len(rows) != 1 || rows[0].Name != "Biaya Admin Bank" || rows[0].Amount != 6500 {
		t.Fatalf("spending by category = %+v, want one Biaya Admin Bank row of 6500", rows)
	}

	rec = httptest.NewRecorder()
	s.handleAnalyticsSummary(rec, asUser(httptest.NewRequest(http.MethodGet, "/analytics/summary?from=2026-11-01&to=2026-11-30", nil), u.ID))
	var summary struct {
		Expense     float64 `json:"expense"`
		Transfer    float64 `json:"transfer"`
		NetCashflow float64 `json:"net_cashflow"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &summary); err != nil {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
	if summary.Expense != 6500 || summary.Transfer != 200000 || summary.NetCashflow != -6500 {
		t.Fatalf("summary = %+v", summary)
	}
}

func TestPatchTransactionCanClearCategory(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "patch@example.invalid", 0)
	food := categoryID(t, s, u.ID, "Makan")
	var txID string
	if err := pool.QueryRow(ctx, `
		insert into transactions(user_id, wallet_id, category_id, type, status, transaction_at, amount)
		values ($1, $2, $3, 'expense', 'pending', now(), 1000) returning id::text
	`, u.ID, u.WalletID, food).Scan(&txID); err != nil {
		t.Fatal(err)
	}
	patch := func(body string) *string {
		t.Helper()
		req := httptest.NewRequest(http.MethodPatch, "/transactions/"+txID, strings.NewReader(body))
		req.SetPathValue("id", txID)
		rec := httptest.NewRecorder()
		s.handlePatchTransaction(rec, asUser(req, u.ID))
		if rec.Code != http.StatusOK {
			t.Fatalf("patch %s: %d %s", body, rec.Code, rec.Body.String())
		}
		var category *string
		if err := pool.QueryRow(ctx, `select category_id::text from transactions where id = $1`, txID).Scan(&category); err != nil {
			t.Fatal(err)
		}
		return category
	}
	if got := patch(`{"note":"tanpa kategori"}`); got == nil || *got != food {
		t.Fatalf("omitting category_id changed it to %v", got)
	}
	if got := patch(`{"category_id":null}`); got != nil {
		t.Fatalf("category_id null left %v", *got)
	}
}

func TestProfileTimezoneIsValidated(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "profile@example.invalid", 0)
	if _, err := pool.Exec(ctx, `insert into profiles(id) values ($1)`, u.ID); err != nil {
		t.Fatal(err)
	}
	send := func(body string) int {
		rec := httptest.NewRecorder()
		s.handlePatchMe(rec, asUser(httptest.NewRequest(http.MethodPatch, "/me", strings.NewReader(body)), u.ID))
		return rec.Code
	}
	if code := send(`{"timezone":"Mars/Olympus"}`); code != http.StatusBadRequest {
		t.Fatalf("unknown zone answered %d", code)
	}
	if code := send(`{"timezone":"+07:00"}`); code != http.StatusBadRequest {
		t.Fatalf("offset answered %d", code)
	}
	if code := send(`{"timezone":"Asia/Makassar"}`); code != http.StatusOK {
		t.Fatalf("Asia/Makassar answered %d", code)
	}
	if got := s.userLocation(ctx, u.ID).String(); got != "Asia/Makassar" {
		t.Fatalf("stored zone = %s", got)
	}
}
