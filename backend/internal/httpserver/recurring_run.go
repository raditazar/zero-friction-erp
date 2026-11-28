package httpserver

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

// recurringRuleRow is one recurring_rules row as returned by to_jsonb.
type recurringRuleRow struct {
	ID                  string      `json:"id"`
	UserID              string      `json:"user_id"`
	WalletID            string      `json:"wallet_id"`
	DestinationWalletID *string     `json:"destination_wallet_id"`
	CategoryID          *string     `json:"category_id"`
	Name                string      `json:"name"`
	Type                string      `json:"type"`
	Merchant            *string     `json:"merchant"`
	Amount              json.Number `json:"amount"`
	Currency            string      `json:"currency"`
	CronExpression      string      `json:"cron_expression"`
	Status              string      `json:"status"`
	NextRunAt           *time.Time  `json:"next_run_at"`
	LastRunAt           *time.Time  `json:"last_run_at"`
	LastScheduledFor    *time.Time  `json:"last_scheduled_for"`
	AutoApprove         *bool       `json:"auto_approve"`
	Note                *string     `json:"note"`
	CreatedAt           time.Time   `json:"created_at"`
}

// cursor is the point after which occurrences are still unbooked: the last booked occurrence,
// else the last run under the old scheduler, else the rule's creation.
func (r recurringRuleRow) cursor() time.Time {
	switch {
	case r.LastScheduledFor != nil:
		return *r.LastScheduledFor
	case r.LastRunAt != nil:
		return *r.LastRunAt
	default:
		return r.CreatedAt
	}
}

func (r recurringRuleRow) transactionStatus() string {
	if r.AutoApprove != nil && !*r.AutoApprove {
		return "pending"
	}
	return "approved"
}

type recurringRuleIssue struct {
	RuleID string `json:"rule_id"`
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

type recurringRunResult struct {
	Status               string               `json:"status"`
	Timezone             string               `json:"timezone"`
	InsertedTransactions int                  `json:"inserted_transactions"`
	CreatedTransactions  []json.RawMessage    `json:"created_transactions"`
	UpdatedRules         []json.RawMessage    `json:"updated_rules"`
	PausedRules          []recurringRuleIssue `json:"paused_rules"`
	FailedRules          []recurringRuleIssue `json:"failed_rules"`
}

// userLocation returns the user's timezone from profiles.timezone (migration 014), falling
// back to Asia/Jakarta. It reads the column through to_jsonb so the query also works on a
// database where 014 has not run yet.
func userLocation(ctx context.Context, q rowQuerier, uid string) *time.Location {
	var name string
	_ = q.QueryRow(ctx, `select coalesce(to_jsonb(p)->>'timezone', '') from profiles p where p.id = $1`, uid).Scan(&name)
	if !validTimezone(name) {
		name = ""
	}
	return loadLocationOrDefault(name)
}

// loadDueRules returns the user's active rules whose next run is due at `now`. With lock set
// the rows are locked for the rest of the transaction and rules locked by a concurrent run
// are skipped.
func loadDueRules(ctx context.Context, q rowQuerier, uid string, now time.Time, lock bool) ([]recurringRuleRow, error) {
	lockClause := ""
	if lock {
		lockClause = "for update skip locked"
	}
	var raw json.RawMessage
	err := q.QueryRow(ctx, `
		select coalesce(jsonb_agg(to_jsonb(r) order by r.next_run_at nulls first, r.id), '[]'::jsonb)
		from (
			select * from recurring_rules
			where user_id = $1 and deleted_at is null and status = 'active'
				and (next_run_at is null or next_run_at <= $2)
			`+lockClause+`
		) r
	`, uid, now).Scan(&raw)
	if err != nil {
		return nil, err
	}
	var rules []recurringRuleRow
	if err := json.Unmarshal(raw, &rules); err != nil {
		return nil, err
	}
	return rules, nil
}

// planRule lists the occurrences to book now and the rule's next run.
func planRule(rule recurringRuleRow, loc *time.Location, now time.Time) (recurringSchedule, []time.Time, time.Time, error) {
	sc, err := parseRecurringSchedule(rule.CronExpression)
	if err != nil {
		return sc, nil, time.Time{}, err
	}
	occ := sc.occurrences(rule.cursor(), now, loc, maxOccurrencesPerRun)
	next := sc.next(now, loc)
	if len(occ) == maxOccurrencesPerRun {
		// More may be missing: stay due so the next run continues the catch-up.
		next = sc.next(occ[len(occ)-1], loc)
	}
	return sc, occ, next, nil
}

// runRecurringForUser books every due occurrence of the user's active rules in one DB
// transaction. Each occurrence is idempotent (unique rule + occurrence), so overlapping or
// repeated runs never double-book.
func (s *Server) runRecurringForUser(ctx context.Context, uid string, now time.Time) (recurringRunResult, error) {
	var result recurringRunResult
	err := s.withTx(ctx, func(q rowQuerier) error {
		result = recurringRunResult{
			Status:              "ok",
			CreatedTransactions: []json.RawMessage{},
			UpdatedRules:        []json.RawMessage{},
			PausedRules:         []recurringRuleIssue{},
			FailedRules:         []recurringRuleIssue{},
		}
		loc := userLocation(ctx, q, uid)
		result.Timezone = loc.String()
		rules, err := loadDueRules(ctx, q, uid, now, true)
		if err != nil {
			return err
		}
		for _, rule := range rules {
			_, occurrences, next, planErr := planRule(rule, loc, now)
			if planErr != nil {
				var ruleJSON json.RawMessage
				if err := q.QueryRow(ctx, `
					update recurring_rules set status = 'paused' where id = $1
					returning to_jsonb(recurring_rules.*)
				`, rule.ID).Scan(&ruleJSON); err != nil {
					return err
				}
				result.UpdatedRules = append(result.UpdatedRules, ruleJSON)
				result.PausedRules = append(result.PausedRules, recurringRuleIssue{RuleID: rule.ID, Name: rule.Name, Reason: planErr.Error()})
				continue
			}

			var lastBooked *time.Time
			failed := false
			for _, occ := range occurrences {
				txJSON, inserted, err := insertRecurringOccurrence(ctx, q, rule, occ)
				if err != nil {
					if _, message, rejected := clientDBError(err); rejected {
						result.FailedRules = append(result.FailedRules, recurringRuleIssue{RuleID: rule.ID, Name: rule.Name, Reason: message})
						failed = true
						break
					}
					return err
				}
				occ := occ
				lastBooked = &occ
				if inserted {
					result.CreatedTransactions = append(result.CreatedTransactions, txJSON)
				}
			}

			var ruleJSON json.RawMessage
			var nextArg any = next
			if failed {
				nextArg = nil // keep the current next_run_at so the next run tries again
			}
			if err := q.QueryRow(ctx, `
				update recurring_rules set
					last_scheduled_for = coalesce($2, last_scheduled_for),
					last_run_at = case when $2::timestamptz is not null then now() else last_run_at end,
					next_run_at = coalesce($3::timestamptz, next_run_at)
				where id = $1
				returning to_jsonb(recurring_rules.*)
			`, rule.ID, lastBooked, nextArg).Scan(&ruleJSON); err != nil {
				return err
			}
			result.UpdatedRules = append(result.UpdatedRules, ruleJSON)
		}
		result.InsertedTransactions = len(result.CreatedTransactions)
		return nil
	})
	return result, err
}

// insertRecurringOccurrence books one occurrence in a savepoint. inserted is false when that
// occurrence was already booked.
func insertRecurringOccurrence(ctx context.Context, q rowQuerier, rule recurringRuleRow, occ time.Time) (json.RawMessage, bool, error) {
	var txJSON json.RawMessage
	err := withSavepoint(ctx, q, func(sp rowQuerier) error {
		return sp.QueryRow(ctx, `
			insert into transactions (
				user_id, wallet_id, destination_wallet_id, category_id, type, status,
				transaction_at, merchant, amount, input_source, input_mode, note,
				recurring_rule_id, scheduled_for
			) values (
				$1, $2::uuid, nullif($3, '')::uuid, nullif($4, '')::uuid, $5::transaction_type, $6::transaction_status,
				$7, $8, $9::numeric, 'cronjob', 'scheduled', $10,
				$11::uuid, $7
			)
			on conflict (recurring_rule_id, scheduled_for) where recurring_rule_id is not null do nothing
			returning to_jsonb(transactions.*)
		`, rule.UserID, rule.WalletID, stringValueOrEmpty(rule.DestinationWalletID), stringValueOrEmpty(rule.CategoryID),
			rule.Type, rule.transactionStatus(), occ, rule.Merchant, rule.Amount.String(), rule.Note, rule.ID).Scan(&txJSON)
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return txJSON, true, nil
}

func (s *Server) handleRunRecurring(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	result, err := s.runRecurringForUser(r.Context(), userID(r), time.Now())
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// handlePreviewRecurring plans the same run as handleRunRecurring without writing anything.
func (s *Server) handlePreviewRecurring(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	ctx := r.Context()
	uid := userID(r)
	now := time.Now()
	loc := userLocation(ctx, s.db, uid)
	rules, err := loadDueRules(ctx, s.db, uid, now, false)
	if err != nil {
		s.writeDBError(w, err)
		return
	}

	dueRules := []recurringRuleRow{}
	transactions := []map[string]any{}
	impact := map[string]float64{}
	for _, rule := range rules {
		_, occurrences, _, planErr := planRule(rule, loc, now)
		if planErr != nil || len(occurrences) == 0 {
			continue
		}
		dueRules = append(dueRules, rule)
		amount, _ := strconv.ParseFloat(rule.Amount.String(), 64)
		status := rule.transactionStatus()
		for _, occ := range occurrences {
			transactions = append(transactions, map[string]any{
				"recurring_rule_id":     rule.ID,
				"user_id":               rule.UserID,
				"wallet_id":             rule.WalletID,
				"destination_wallet_id": rule.DestinationWalletID,
				"category_id":           rule.CategoryID,
				"type":                  rule.Type,
				"status":                status,
				"transaction_at":        occ,
				"scheduled_for":         occ,
				"merchant":              rule.Merchant,
				"amount":                rule.Amount,
				"currency":              rule.Currency,
				"note":                  rule.Note,
				"input_source":          "cronjob",
				"input_mode":            "scheduled",
			})
			if status != "approved" {
				continue // pending items do not move balances until approved
			}
			switch rule.Type {
			case "income", "adjustment":
				impact[rule.WalletID] += amount
			case "expense":
				impact[rule.WalletID] -= amount
			case "transfer":
				impact[rule.WalletID] -= amount
				if rule.DestinationWalletID != nil {
					impact[*rule.DestinationWalletID] += amount
				}
			}
		}
	}

	var walletsRaw json.RawMessage
	if err := s.db.QueryRow(ctx, `
		select coalesce(jsonb_agg(to_jsonb(wb) order by wb.name), '[]'::jsonb)
		from wallet_balances wb where wb.user_id = $1
	`, uid).Scan(&walletsRaw); err != nil {
		s.writeDBError(w, err)
		return
	}
	var wallets []map[string]any
	if err := json.Unmarshal(walletsRaw, &wallets); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read wallet balances")
		return
	}
	for _, wallet := range wallets {
		id, _ := wallet["id"].(string)
		before := numberFromAny(wallet["curr_balance"])
		wallet["balance_before"] = before
		wallet["impact"] = impact[id]
		wallet["balance_after"] = before + impact[id]
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"basis":           "wallet_balances: approved transactions; recurring items that go to the Inbox as pending do not change balances until approved",
		"timezone":        loc.String(),
		"due_rules":       dueRules,
		"transactions":    transactions,
		"wallet_balances": wallets,
	})
}

func numberFromAny(value any) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	case json.Number:
		f, _ := v.Float64()
		return f
	}
	return 0
}

func (s *Server) registerCron(mux *http.ServeMux) {
	mux.HandleFunc("GET /cron/run-recurring-all", s.handleCronRunRecurringAll)
	mux.HandleFunc("POST /cron/run-recurring-all", s.handleCronRunRecurringAll)
}

// handleCronRunRecurringAll runs due recurring rules for every user. Vercel Cron calls it with
// "Authorization: Bearer $CRON_SECRET"; any other scheduler can do the same.
func (s *Server) handleCronRunRecurringAll(w http.ResponseWriter, r *http.Request) {
	secret := os.Getenv("CRON_SECRET")
	if secret == "" {
		writeError(w, http.StatusServiceUnavailable, "CRON_SECRET is not configured")
		return
	}
	if subtle.ConstantTimeCompare([]byte(bearerToken(r)), []byte(secret)) != 1 {
		writeError(w, http.StatusUnauthorized, "valid cron secret is required")
		return
	}
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 50*time.Second)
	defer cancel()
	now := time.Now()

	var usersRaw json.RawMessage
	if err := s.db.QueryRow(ctx, `
		select coalesce(jsonb_agg(distinct user_id::text), '[]'::jsonb)
		from recurring_rules
		where deleted_at is null and status = 'active' and (next_run_at is null or next_run_at <= $1)
	`, now).Scan(&usersRaw); err != nil {
		s.writeDBError(w, err)
		return
	}
	var users []string
	_ = json.Unmarshal(usersRaw, &users)

	summary := map[string]any{"users": len(users)}
	inserted, failedRules, pausedRules, failedUsers := 0, 0, 0, 0
	for _, uid := range users {
		if ctx.Err() != nil {
			summary["stopped_early"] = true // the rest stay due for the next run
			break
		}
		result, err := s.runRecurringForUser(ctx, uid, now)
		if err != nil {
			failedUsers++
			s.logger.Error("recurring run failed", "user_id", uid, "error", err)
			continue
		}
		inserted += result.InsertedTransactions
		failedRules += len(result.FailedRules)
		pausedRules += len(result.PausedRules)
	}
	summary["inserted_transactions"] = inserted
	summary["failed_rules"] = failedRules
	summary["paused_rules"] = pausedRules
	summary["failed_users"] = failedUsers
	s.logger.Info("recurring cron finished", "summary", summary)
	writeJSON(w, http.StatusOK, summary)
}
