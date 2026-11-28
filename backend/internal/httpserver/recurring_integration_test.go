package httpserver

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// seedRule inserts an active rule whose cursor (last_scheduled_for) and next run are given.
func seedRule(t *testing.T, pool *pgxpool.Pool, u testUser, cron string, autoApprove bool, lastScheduled, nextRun time.Time) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(), `
		insert into recurring_rules (user_id, wallet_id, name, type, merchant, amount, cron_expression, next_run_at, last_scheduled_for, auto_approve)
		values ($1, $2, 'Langganan', 'expense', 'Netflix', 54000, $3, $4, $5, $6)
		returning id::text
	`, u.ID, u.WalletID, cron, nextRun, lastScheduled, autoApprove).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func countRuleTransactions(t *testing.T, pool *pgxpool.Pool, ruleID, status string) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), `
		select count(*) from transactions where recurring_rule_id = $1 and ($2 = '' or status::text = $2)
	`, ruleID, status).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestRecurringCatchUpBooksEachMissedMonthOnceAtScheduledTime(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "rec@example.invalid", 1_000_000)
	jkt, _ := time.LoadLocation("Asia/Jakarta")

	// Monthly on the 5th at 09:00 WIB; last booked August, now is 20 November: 3 missed.
	last := time.Date(2026, 8, 5, 9, 0, 0, 0, jkt)
	ruleID := seedRule(t, pool, u, "0 9 5 * *", true, last, time.Date(2026, 9, 5, 9, 0, 0, 0, jkt))
	now := time.Date(2026, 11, 20, 12, 0, 0, 0, jkt)

	result, err := s.runRecurringForUser(ctx, u.ID, now)
	if err != nil {
		t.Fatal(err)
	}
	if result.InsertedTransactions != 3 {
		t.Fatalf("want 3 transactions, got %d (%+v)", result.InsertedTransactions, result)
	}
	rows, err := pool.Query(ctx, `select transaction_at from transactions where recurring_rule_id = $1 order by transaction_at`, ruleID)
	if err != nil {
		t.Fatal(err)
	}
	var dates []time.Time
	for rows.Next() {
		var at time.Time
		if err := rows.Scan(&at); err != nil {
			t.Fatal(err)
		}
		dates = append(dates, at.In(jkt))
	}
	rows.Close()
	for i, month := range []time.Month{time.September, time.October, time.November} {
		want := time.Date(2026, month, 5, 9, 0, 0, 0, jkt)
		if !dates[i].Equal(want) {
			t.Fatalf("transaction %d dated %v, want %v", i, dates[i], want)
		}
	}
	if got := walletBalance(t, pool, u.WalletID); got != 1_000_000-3*54000 {
		t.Fatalf("balance = %v", got)
	}

	var nextRun time.Time
	if err := pool.QueryRow(ctx, `select next_run_at from recurring_rules where id = $1`, ruleID).Scan(&nextRun); err != nil {
		t.Fatal(err)
	}
	if !nextRun.Equal(time.Date(2026, 12, 5, 9, 0, 0, 0, jkt)) {
		t.Fatalf("next_run_at = %v, want 5 Dec 09:00 WIB", nextRun.In(jkt))
	}

	// Running again (second cron, manual click) books nothing new.
	result, err = s.runRecurringForUser(ctx, u.ID, now)
	if err != nil {
		t.Fatal(err)
	}
	if result.InsertedTransactions != 0 || countRuleTransactions(t, pool, ruleID, "") != 3 {
		t.Fatalf("second run must not double-book, inserted %d", result.InsertedTransactions)
	}
}

func TestRecurringOccurrenceIsUniqueEvenIfRuleCursorIsStale(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "rec@example.invalid", 0)
	jkt, _ := time.LoadLocation("Asia/Jakarta")
	last := time.Date(2026, 11, 18, 9, 0, 0, 0, jkt)
	ruleID := seedRule(t, pool, u, "0 9 * * *", true, last, last)
	now := time.Date(2026, 11, 20, 10, 0, 0, 0, jkt)

	if _, err := s.runRecurringForUser(ctx, u.ID, now); err != nil {
		t.Fatal(err)
	}
	// Simulate a crashed run that booked rows but never advanced the rule.
	if _, err := pool.Exec(ctx, `update recurring_rules set last_scheduled_for = $2, next_run_at = $2 where id = $1`, ruleID, last); err != nil {
		t.Fatal(err)
	}
	result, err := s.runRecurringForUser(ctx, u.ID, now)
	if err != nil {
		t.Fatal(err)
	}
	if result.InsertedTransactions != 0 || countRuleTransactions(t, pool, ruleID, "") != 2 {
		t.Fatalf("unique occurrence key must stop duplicates, inserted %d", result.InsertedTransactions)
	}
}

func TestRecurringAutoApproveOffGoesToInbox(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "rec@example.invalid", 500_000)
	jkt, _ := time.LoadLocation("Asia/Jakarta")
	last := time.Date(2026, 10, 20, 8, 0, 0, 0, jkt)
	ruleID := seedRule(t, pool, u, "0 8 20 * *", false, last, last.AddDate(0, 1, 0))

	if _, err := s.runRecurringForUser(ctx, u.ID, time.Date(2026, 11, 20, 9, 0, 0, 0, jkt)); err != nil {
		t.Fatal(err)
	}
	if countRuleTransactions(t, pool, ruleID, "pending") != 1 {
		t.Fatal("auto_approve=false must create a pending transaction")
	}
	if got := walletBalance(t, pool, u.WalletID); got != 500_000 {
		t.Fatalf("pending item must not move the balance, got %v", got)
	}
}

func TestRecurringInvalidCronPausesRule(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	u := seedUser(t, pool, "rec@example.invalid", 0)
	past := time.Now().Add(-48 * time.Hour)
	ruleID := seedRule(t, pool, u, "*/5 * * * *", true, past, past)

	result, err := s.runRecurringForUser(ctx, u.ID, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	var status string
	if err := pool.QueryRow(ctx, `select status::text from recurring_rules where id = $1`, ruleID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "paused" || len(result.PausedRules) != 1 || countRuleTransactions(t, pool, ruleID, "") != 0 {
		t.Fatalf("want paused rule and no transactions, got status=%s result=%+v", status, result)
	}
}

func TestCronEndpointRequiresSecretAndRunsAllUsers(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	t.Setenv("CRON_SECRET", "cron-test-secret")
	router := NewRouter(slog.Default(), pool)
	a := seedUser(t, pool, "a@example.invalid", 0)
	b := seedUser(t, pool, "b@example.invalid", 0)
	yesterday := time.Now().Add(-26 * time.Hour)
	ruleA := seedRule(t, pool, a, "0 9 * * *", true, yesterday.Add(-24*time.Hour), yesterday)
	ruleB := seedRule(t, pool, b, "0 9 * * *", true, yesterday.Add(-24*time.Hour), yesterday)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/cron/run-recurring-all", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("no secret: want 401, got %d", rec.Code)
	}

	req := httptest.NewRequest(http.MethodGet, "/cron/run-recurring-all", nil)
	req.Header.Set("Authorization", "Bearer cron-test-secret")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if countRuleTransactions(t, pool, ruleA, "") == 0 || countRuleTransactions(t, pool, ruleB, "") == 0 {
		t.Fatalf("both users' rules should have run: %s", rec.Body.String())
	}
	_ = ctx
}

func TestPatchRuleResumeDoesNotBookPausedPeriod(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	u := seedUser(t, pool, "rec@example.invalid", 0)
	longAgo := time.Now().AddDate(0, -3, 0)
	ruleID := seedRule(t, pool, u, "0 9 * * *", true, longAgo, longAgo)
	if _, err := pool.Exec(ctx, `update recurring_rules set status = 'paused' where id = $1`, ruleID); err != nil {
		t.Fatal(err)
	}

	s := &Server{db: pool, logger: slog.Default()}
	body := `{"status":"active"}`
	req := withUserID(httptest.NewRequest(http.MethodPatch, "/recurring-rules/"+ruleID, strings.NewReader(body)), u.ID)
	req.SetPathValue("id", ruleID)
	rec := httptest.NewRecorder()
	s.handlePatchRecurringRule(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch failed: %d %s", rec.Code, rec.Body.String())
	}
	result, err := s.runRecurringForUser(ctx, u.ID, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if result.InsertedTransactions > 1 {
		t.Fatalf("resuming must not book the paused months, booked %d", result.InsertedTransactions)
	}
}
