package httpserver

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type savingGoalPayload struct {
	WalletID      *string  `json:"wallet_id"`
	Name          *string  `json:"name"`
	TargetAmount  *float64 `json:"target_amount"`
	CurrentAmount *float64 `json:"current_amount"`
	Currency      *string  `json:"currency"`
	TargetDate    *string  `json:"target_date"`
	Status        *string  `json:"status"`
	Note          *string  `json:"note"`
}

type sinkingFundPayload struct {
	SavingGoalID  *string  `json:"saving_goal_id"`
	WalletID      *string  `json:"wallet_id"`
	Name          *string  `json:"name"`
	TargetAmount  *float64 `json:"target_amount"`
	CurrentAmount *float64 `json:"current_amount"`
	MonthlyTarget *float64 `json:"monthly_target"`
	Currency      *string  `json:"currency"`
	TargetDate    *string  `json:"target_date"`
	Status        *string  `json:"status"`
}


type incomeRoutingRulePayload struct {
	Name                *string  `json:"name"`
	MatchCategoryID     *string  `json:"match_category_id"`
	MatchTagID          *string  `json:"match_tag_id"`
	MinAmount           *float64 `json:"min_amount"`
	Percentage          *float64 `json:"percentage"`
	DestinationWalletID *string  `json:"destination_wallet_id"`
	SavingGoalID        *string  `json:"saving_goal_id"`
	SinkingFundID       *string  `json:"sinking_fund_id"`
	Priority            *int     `json:"priority"`
	IsActive            *bool    `json:"is_active"`
}

type incomeAllocationPayload struct {
	IncomeTransactionID *string  `json:"income_transaction_id"`
	RoutingRuleID       *string  `json:"routing_rule_id"`
	DestinationWalletID *string  `json:"destination_wallet_id"`
	SavingGoalID        *string  `json:"saving_goal_id"`
	SinkingFundID       *string  `json:"sinking_fund_id"`
	Amount              *float64 `json:"amount"`
	Percentage          *float64 `json:"percentage"`
	Status              *string  `json:"status"`
	AllocatedAt         *string  `json:"allocated_at"`
}

type recurringRulePayload struct {
	WalletID            *string  `json:"wallet_id"`
	DestinationWalletID *string  `json:"destination_wallet_id"`
	CategoryID          *string  `json:"category_id"`
	Name                *string  `json:"name"`
	Type                *string  `json:"type"`
	Merchant            *string  `json:"merchant"`
	Amount              *float64 `json:"amount"`
	Currency            *string  `json:"currency"`
	CronExpression      *string  `json:"cron_expression"`
	Interval            *string  `json:"interval"`
	DayOfMonth          *int     `json:"day_of_month"`
	Weekday             *int     `json:"weekday"`
	Time                *string  `json:"time"`
	Status              *string  `json:"status"`
	NextRunAt           *string  `json:"next_run_at"`
	Note                *string  `json:"note"`
	AutoApprove         *bool    `json:"auto_approve"`
}

type tokenPayload struct {
	Name      *string  `json:"name"`
	Scopes    []string `json:"scopes"`
	Source    *string  `json:"source"`
	ExpiresAt *string  `json:"expires_at"`
}

func (s *Server) registerExtendedResources(mux *http.ServeMux) {
	mux.HandleFunc("GET /saving-goals", s.listTable("saving_goals", "created_at"))
	mux.HandleFunc("POST /saving-goals", s.handleCreateSavingGoal)
	mux.HandleFunc("GET /saving-goals/{id}", s.getByID("saving_goals"))
	mux.HandleFunc("PATCH /saving-goals/{id}", s.handlePatchSavingGoal)
	mux.HandleFunc("DELETE /saving-goals/{id}", s.deleteByID("saving_goals"))

	mux.HandleFunc("GET /sinking-funds", s.listTable("sinking_funds", "created_at"))
	mux.HandleFunc("POST /sinking-funds", s.handleCreateSinkingFund)
	mux.HandleFunc("GET /sinking-funds/{id}", s.getByID("sinking_funds"))
	mux.HandleFunc("PATCH /sinking-funds/{id}", s.handlePatchSinkingFund)
	mux.HandleFunc("DELETE /sinking-funds/{id}", s.deleteByID("sinking_funds"))



	mux.HandleFunc("GET /income-routing-rules", s.listTable("income_routing_rules", "priority"))
	mux.HandleFunc("POST /income-routing-rules", s.handleCreateIncomeRoutingRule)
	mux.HandleFunc("GET /income-routing-rules/{id}", s.getByID("income_routing_rules"))
	mux.HandleFunc("PATCH /income-routing-rules/{id}", s.handlePatchIncomeRoutingRule)
	mux.HandleFunc("DELETE /income-routing-rules/{id}", s.deleteByID("income_routing_rules"))

	mux.HandleFunc("GET /income-allocations", s.listTable("income_allocations", "created_at"))
	mux.HandleFunc("POST /income-allocations", s.handleCreateIncomeAllocation)
	mux.HandleFunc("GET /income-allocations/{id}", s.getByID("income_allocations"))
	mux.HandleFunc("PATCH /income-allocations/{id}", s.handlePatchIncomeAllocation)
	mux.HandleFunc("DELETE /income-allocations/{id}", s.deleteByID("income_allocations"))

	mux.HandleFunc("GET /recurring-rules", s.listTable("recurring_rules", "created_at"))
	mux.HandleFunc("POST /recurring-rules", s.handleCreateRecurringRule)
	mux.HandleFunc("GET /recurring-rules/{id}", s.getByID("recurring_rules"))
	mux.HandleFunc("PATCH /recurring-rules/{id}", s.handlePatchRecurringRule)
	mux.HandleFunc("DELETE /recurring-rules/{id}", s.deleteByID("recurring_rules"))
	mux.HandleFunc("POST /cron/run-recurring", s.handleRunRecurring)
	mux.HandleFunc("POST /cron/run-recurring/preview", s.handlePreviewRecurring)

	mux.HandleFunc("GET /api-keys", s.handleListAPIKeys)
	mux.HandleFunc("POST /api-keys", s.handleCreateAPIKey)
	mux.HandleFunc("DELETE /api-keys/{id}", s.handleRevokeAPIKey)

	mux.HandleFunc("GET /webhook-tokens", s.handleListWebhookTokens)
	mux.HandleFunc("POST /webhook-tokens", s.handleCreateWebhookToken)
	mux.HandleFunc("DELETE /webhook-tokens/{id}", s.handleRevokeWebhookToken)
}

func (s *Server) listTable(table, orderColumn string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sql := fmt.Sprintf(`
			select coalesce(jsonb_agg(to_jsonb(t) order by t.%s), '[]'::jsonb)
			from %s t
			where t.user_id = $1 and t.deleted_at is null
		`, orderColumn, table)
		s.writeQueryJSON(w, r, http.StatusOK, sql, userID(r))
	}
}

func (s *Server) getByID(table string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sql := fmt.Sprintf(`
			select to_jsonb(t)
			from %s t
			where t.user_id = $1 and t.id = $2 and t.deleted_at is null
		`, table)
		s.writeQueryJSON(w, r, http.StatusOK, sql, userID(r), r.PathValue("id"))
	}
}

func (s *Server) deleteByID(table string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.softDelete(w, r, table, r.PathValue("id"))
	}
}

func (s *Server) handleCreateSavingGoal(w http.ResponseWriter, r *http.Request) {
	var p savingGoalPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if missing(p.Name) || p.TargetAmount == nil {
		writeError(w, http.StatusBadRequest, "name and target_amount are required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into saving_goals (user_id, wallet_id, name, target_amount, current_amount, currency, target_date, status, note)
		values ($1, nullif($2, '')::uuid, $3, $4, coalesce($5, 0), coalesce($6, 'IDR'), nullif($7, '')::date, coalesce($8::goal_status, 'active'), $9)
		returning to_jsonb(saving_goals.*)
	`, userID(r), stringValueOrEmpty(p.WalletID), stringValue(p.Name), floatValue(p.TargetAmount), floatValue(p.CurrentAmount), stringValue(p.Currency), stringValueOrEmpty(p.TargetDate), stringValue(p.Status), stringValue(p.Note))
}

func (s *Server) handlePatchSavingGoal(w http.ResponseWriter, r *http.Request) {
	var p savingGoalPayload
	if !decodeBody(w, r, &p) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update saving_goals set
			wallet_id = coalesce(nullif($3, '')::uuid, wallet_id),
			name = coalesce($4, name),
			target_amount = coalesce($5, target_amount),
			current_amount = coalesce($6, current_amount),
			currency = coalesce($7, currency),
			target_date = coalesce(nullif($8, '')::date, target_date),
			status = coalesce($9::goal_status, status),
			note = coalesce($10, note)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(saving_goals.*)
	`, userID(r), r.PathValue("id"), stringValueOrEmpty(p.WalletID), stringValue(p.Name), floatValue(p.TargetAmount), floatValue(p.CurrentAmount), stringValue(p.Currency), stringValueOrEmpty(p.TargetDate), stringValue(p.Status), stringValue(p.Note))
}

func (s *Server) handleCreateSinkingFund(w http.ResponseWriter, r *http.Request) {
	var p sinkingFundPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if missing(p.Name) || p.TargetAmount == nil {
		writeError(w, http.StatusBadRequest, "name and target_amount are required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into sinking_funds (user_id, saving_goal_id, wallet_id, name, target_amount, current_amount, monthly_target, currency, target_date, status)
		values ($1, nullif($2, '')::uuid, nullif($3, '')::uuid, $4, $5, coalesce($6, 0), coalesce($7, 0), coalesce($8, 'IDR'), nullif($9, '')::date, coalesce($10::goal_status, 'active'))
		returning to_jsonb(sinking_funds.*)
	`, userID(r), stringValueOrEmpty(p.SavingGoalID), stringValueOrEmpty(p.WalletID), stringValue(p.Name), floatValue(p.TargetAmount), floatValue(p.CurrentAmount), floatValue(p.MonthlyTarget), stringValue(p.Currency), stringValueOrEmpty(p.TargetDate), stringValue(p.Status))
}

func (s *Server) handlePatchSinkingFund(w http.ResponseWriter, r *http.Request) {
	var p sinkingFundPayload
	if !decodeBody(w, r, &p) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update sinking_funds set
			saving_goal_id = coalesce(nullif($3, '')::uuid, saving_goal_id),
			wallet_id = coalesce(nullif($4, '')::uuid, wallet_id),
			name = coalesce($5, name),
			target_amount = coalesce($6, target_amount),
			current_amount = coalesce($7, current_amount),
			monthly_target = coalesce($8, monthly_target),
			currency = coalesce($9, currency),
			target_date = coalesce(nullif($10, '')::date, target_date),
			status = coalesce($11::goal_status, status)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(sinking_funds.*)
	`, userID(r), r.PathValue("id"), stringValueOrEmpty(p.SavingGoalID), stringValueOrEmpty(p.WalletID), stringValue(p.Name), floatValue(p.TargetAmount), floatValue(p.CurrentAmount), floatValue(p.MonthlyTarget), stringValue(p.Currency), stringValueOrEmpty(p.TargetDate), stringValue(p.Status))
}



func (s *Server) handleCreateIncomeRoutingRule(w http.ResponseWriter, r *http.Request) {
	var p incomeRoutingRulePayload
	if !decodeBody(w, r, &p) {
		return
	}
	if missing(p.Name) || p.Percentage == nil {
		writeError(w, http.StatusBadRequest, "name and percentage are required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into income_routing_rules (user_id, name, match_category_id, match_tag_id, min_amount, percentage, destination_wallet_id, saving_goal_id, sinking_fund_id, priority, is_active)
		values ($1, $2, nullif($3, '')::uuid, nullif($4, '')::uuid, $5, $6, nullif($7, '')::uuid, nullif($8, '')::uuid, nullif($9, '')::uuid, coalesce($10, 100), coalesce($11, true))
		returning to_jsonb(income_routing_rules.*)
	`, userID(r), stringValue(p.Name), stringValueOrEmpty(p.MatchCategoryID), stringValueOrEmpty(p.MatchTagID), floatValue(p.MinAmount), floatValue(p.Percentage), stringValueOrEmpty(p.DestinationWalletID), stringValueOrEmpty(p.SavingGoalID), stringValueOrEmpty(p.SinkingFundID), intValue(p.Priority), boolValue(p.IsActive))
}

func (s *Server) handlePatchIncomeRoutingRule(w http.ResponseWriter, r *http.Request) {
	var p incomeRoutingRulePayload
	if !decodeBody(w, r, &p) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update income_routing_rules set name = coalesce($3, name), min_amount = coalesce($4, min_amount), percentage = coalesce($5, percentage), priority = coalesce($6, priority), is_active = coalesce($7, is_active)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(income_routing_rules.*)
	`, userID(r), r.PathValue("id"), stringValue(p.Name), floatValue(p.MinAmount), floatValue(p.Percentage), intValue(p.Priority), boolValue(p.IsActive))
}

func (s *Server) handleCreateIncomeAllocation(w http.ResponseWriter, r *http.Request) {
	var p incomeAllocationPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if missing(p.IncomeTransactionID) || p.Amount == nil {
		writeError(w, http.StatusBadRequest, "income_transaction_id and amount are required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into income_allocations (user_id, income_transaction_id, routing_rule_id, destination_wallet_id, saving_goal_id, sinking_fund_id, amount, percentage, status, allocated_at)
		values ($1, $2::uuid, nullif($3, '')::uuid, nullif($4, '')::uuid, nullif($5, '')::uuid, nullif($6, '')::uuid, $7, $8, coalesce($9::allocation_status, 'planned'), nullif($10, '')::timestamptz)
		returning to_jsonb(income_allocations.*)
	`, userID(r), stringValue(p.IncomeTransactionID), stringValueOrEmpty(p.RoutingRuleID), stringValueOrEmpty(p.DestinationWalletID), stringValueOrEmpty(p.SavingGoalID), stringValueOrEmpty(p.SinkingFundID), floatValue(p.Amount), floatValue(p.Percentage), stringValue(p.Status), stringValueOrEmpty(p.AllocatedAt))
}

func (s *Server) handlePatchIncomeAllocation(w http.ResponseWriter, r *http.Request) {
	var p incomeAllocationPayload
	if !decodeBody(w, r, &p) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update income_allocations set amount = coalesce($3, amount), percentage = coalesce($4, percentage), status = coalesce($5::allocation_status, status), allocated_at = coalesce(nullif($6, '')::timestamptz, allocated_at)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(income_allocations.*)
	`, userID(r), r.PathValue("id"), floatValue(p.Amount), floatValue(p.Percentage), stringValue(p.Status), stringValueOrEmpty(p.AllocatedAt))
}

func (s *Server) handleCreateRecurringRule(w http.ResponseWriter, r *http.Request) {
	var p recurringRulePayload
	if !decodeBody(w, r, &p) {
		return
	}
	if missing(p.Name) || missing(p.WalletID) || missing(p.Type) || p.Amount == nil {
		writeError(w, http.StatusBadRequest, "name, wallet_id, type, and amount are required")
		return
	}
	cronExpression, err := recurringCron(p)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if cronExpression == nil {
		writeError(w, http.StatusBadRequest, "cron_expression or interval is required")
		return
	}
	nextRunAt := s.recurringNextRun(r, p, cronExpression)
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into recurring_rules (user_id, wallet_id, destination_wallet_id, category_id, name, type, merchant, amount, currency, cron_expression, status, next_run_at, note, auto_approve)
		values ($1, $2::uuid, nullif($3, '')::uuid, nullif($4, '')::uuid, $5, $6::transaction_type, $7, $8, coalesce($9, 'IDR'), $10, coalesce($11::recurring_rule_status, 'active'), nullif($12, '')::timestamptz, $13, coalesce($14::boolean, true))
		returning to_jsonb(recurring_rules.*)
	`, userID(r), stringValue(p.WalletID), stringValueOrEmpty(p.DestinationWalletID), stringValueOrEmpty(p.CategoryID), stringValue(p.Name), stringValue(p.Type), stringValue(p.Merchant), floatValue(p.Amount), stringValue(p.Currency), cronExpression, stringValue(p.Status), nextRunAt, stringValue(p.Note), boolValue(p.AutoApprove))
}

func (s *Server) handlePatchRecurringRule(w http.ResponseWriter, r *http.Request) {
	var p recurringRulePayload
	if !decodeBody(w, r, &p) {
		return
	}
	cronExpression, err := recurringCron(p)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	// A supplied schedule is authoritative.  Recalculate its next run unless the
	// caller explicitly supplied one; ordinary field edits leave both untouched.
	var nextRunAt any = stringValue(p.NextRunAt)
	if cronExpression != nil && p.NextRunAt == nil {
		nextRunAt = s.recurringNextRun(r, p, cronExpression)
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update recurring_rules set
			wallet_id = coalesce(nullif($3, '')::uuid, wallet_id),
			destination_wallet_id = case when $4::text is null then destination_wallet_id when $4::text = '' then null else $4::uuid end,
			category_id = case when $5::text is null then category_id when $5::text = '' then null else $5::uuid end,
			name = coalesce($6, name),
			type = coalesce($7::transaction_type, type),
			merchant = case when $8::text is null then merchant when $8::text = '' then null else $8 end,
			amount = coalesce($9, amount),
			currency = coalesce($10, currency),
			cron_expression = coalesce($11, cron_expression),
			status = coalesce($12::recurring_rule_status, status),
			next_run_at = case when $13::text is null then next_run_at when $13::text = '' then null else $13::timestamptz end,
			note = case when $14::text is null then note when $14::text = '' then null else $14 end,
			auto_approve = coalesce($15::boolean, auto_approve),
			-- A new schedule or a resume starts from now: occurrences missed under the old
			-- schedule or while paused are not booked retroactively.
			last_scheduled_for = case
				when $11::text is not null and $11::text <> cron_expression then now()
				when $12::text = 'active' and status <> 'active' then now()
				else last_scheduled_for
			end
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(recurring_rules.*)
	`, userID(r), r.PathValue("id"), stringValueOrEmpty(p.WalletID), stringValue(p.DestinationWalletID), stringValue(p.CategoryID), stringValue(p.Name), stringValue(p.Type), stringValue(p.Merchant), floatValue(p.Amount), stringValue(p.Currency), cronExpression, stringValue(p.Status), nextRunAt, stringValue(p.Note), boolValue(p.AutoApprove))
}

func (s *Server) handleListAPIKeys(w http.ResponseWriter, r *http.Request) {
	includeRevoked := r.URL.Query().Get("include_revoked") == "true"
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(k) - 'key_hash' order by k.created_at desc), '[]'::jsonb)
		from api_keys k
		where k.user_id = $1 and ($2::boolean or k.deleted_at is null)
	`, userID(r), includeRevoked)
}

func (s *Server) handleCreateAPIKey(w http.ResponseWriter, r *http.Request) {
	var p tokenPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if missing(p.Name) {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	token, hash, prefix, err := newToken("zfe_api")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	if len(p.Scopes) == 0 {
		p.Scopes = []string{"transactions:read", "transactions:write"}
	}
	scopesJSON, _ := json.Marshal(p.Scopes)
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into api_keys (user_id, name, key_hash, key_prefix, scopes, expires_at)
		values ($1, $2, $3, $4, coalesce((select array_agg(value)::text[] from jsonb_array_elements_text($5::jsonb) value), '{}'::text[]), nullif($6, '')::timestamptz)
		returning to_jsonb(api_keys.*) - 'key_hash' || jsonb_build_object('token', $7::text)
	`, userID(r), stringValue(p.Name), hash, prefix, string(scopesJSON), stringValueOrEmpty(p.ExpiresAt), token)
}

func (s *Server) handleRevokeAPIKey(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update api_keys set revoked_at = now(), deleted_at = now()
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(api_keys.*) - 'key_hash'
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleListWebhookTokens(w http.ResponseWriter, r *http.Request) {
	includeRevoked := r.URL.Query().Get("include_revoked") == "true"
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(t) - 'token_hash' order by t.created_at desc), '[]'::jsonb)
		from webhook_tokens t
		where t.user_id = $1 and ($2::boolean or t.deleted_at is null)
	`, userID(r), includeRevoked)
}

func (s *Server) handleCreateWebhookToken(w http.ResponseWriter, r *http.Request) {
	var p tokenPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if missing(p.Name) {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	token, hash, prefix, err := newToken("zfe_wh")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into webhook_tokens (user_id, name, token_hash, token_prefix, source, expires_at)
		values ($1, $2, $3, $4, coalesce(nullif($5, '')::webhook_source, 'ios'), nullif($6, '')::timestamptz)
		returning to_jsonb(webhook_tokens.*) - 'token_hash' || jsonb_build_object('token', $7::text)
	`, userID(r), stringValue(p.Name), hash, prefix, stringValue(p.Source), stringValueOrEmpty(p.ExpiresAt), token)
}

func (s *Server) handleRevokeWebhookToken(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update webhook_tokens set revoked_at = now(), deleted_at = now()
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(webhook_tokens.*) - 'token_hash'
	`, userID(r), r.PathValue("id"))
}

func recurringCron(p recurringRulePayload) (any, error) {
	if p.CronExpression != nil && strings.TrimSpace(*p.CronExpression) != "" {
		return validateRecurringCron(*p.CronExpression)
	}
	if p.Interval == nil {
		return nil, nil
	}
	hour, minute, err := parseClock(p.Time)
	if err != nil {
		return nil, err
	}
	switch strings.ToLower(strings.TrimSpace(*p.Interval)) {
	case "daily":
		return fmt.Sprintf("%d %d * * *", minute, hour), nil
	case "weekly":
		weekday := intValueDefault(p.Weekday, 1)
		if weekday < 0 || weekday > 6 {
			return nil, fmt.Errorf("weekday must be between 0 and 6")
		}
		return fmt.Sprintf("%d %d * * %d", minute, hour, weekday), nil
	case "monthly":
		day := intValueDefault(p.DayOfMonth, 1)
		if day < 1 || day > 31 {
			return nil, fmt.Errorf("day_of_month must be between 1 and 31")
		}
		return fmt.Sprintf("%d %d %d * *", minute, hour, day), nil
	default:
		return nil, fmt.Errorf("interval must be daily, weekly, or monthly")
	}
}

// validateRecurringCron intentionally accepts only the three schedule shapes
// exposed by the API: daily, weekly, and monthly. This keeps the SQL next-run
// calculation safe and in sync with the Go calculation.
func validateRecurringCron(value string) (string, error) {
	fields := strings.Fields(value)
	if len(fields) != 5 || fields[3] != "*" {
		return "", fmt.Errorf("cron_expression must be a daily, weekly, or monthly five-field schedule")
	}
	minute, minuteErr := strconv.Atoi(fields[0])
	hour, hourErr := strconv.Atoi(fields[1])
	if minuteErr != nil || hourErr != nil || minute < 0 || minute > 59 || hour < 0 || hour > 23 {
		return "", fmt.Errorf("cron_expression must contain a valid minute and hour")
	}
	if fields[2] == "*" && fields[4] == "*" {
		return fmt.Sprintf("%d %d * * *", minute, hour), nil
	}
	if fields[2] == "*" {
		weekday, err := strconv.Atoi(fields[4])
		if err != nil || weekday < 0 || weekday > 6 {
			return "", fmt.Errorf("weekly cron_expression weekday must be between 0 and 6")
		}
		return fmt.Sprintf("%d %d * * %d", minute, hour, weekday), nil
	}
	if fields[4] == "*" {
		day, err := strconv.Atoi(fields[2])
		if err != nil || day < 1 || day > 31 {
			return "", fmt.Errorf("monthly cron_expression day_of_month must be between 1 and 31")
		}
		return fmt.Sprintf("%d %d %d * *", minute, hour, day), nil
	}
	return "", fmt.Errorf("cron_expression must be a daily, weekly, or monthly schedule")
}

// recurringNextRun is the first occurrence after now in the user's timezone, unless the
// caller supplied next_run_at.
func (s *Server) recurringNextRun(r *http.Request, p recurringRulePayload, cronExpression any) string {
	if p.NextRunAt != nil {
		return *p.NextRunAt
	}
	cron, _ := cronExpression.(string)
	sc, err := parseRecurringSchedule(cron)
	if err != nil {
		return ""
	}
	loc := loadLocationOrDefault("")
	if s.db != nil {
		loc = userLocation(r.Context(), s.db, userID(r))
	}
	return sc.next(time.Now(), loc).Format(time.RFC3339)
}
func parseClock(value *string) (int, int, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return 9, 0, nil
	}
	parts := strings.Split(*value, ":")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("time must use HH:MM format")
	}
	hour, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, fmt.Errorf("time hour is invalid")
	}
	minute, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, fmt.Errorf("time minute is invalid")
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return 0, 0, fmt.Errorf("time must be within 00:00-23:59")
	}
	return hour, minute, nil
}

func daysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

func newToken(prefix string) (string, string, string, error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", "", err
	}
	raw := base64.RawURLEncoding.EncodeToString(randomBytes)
	token := prefix + "_" + raw
	hashBytes := sha256.Sum256([]byte(token))
	tokenPrefix := token
	if len(tokenPrefix) > len(prefix)+9 {
		tokenPrefix = tokenPrefix[:len(prefix)+9]
	}
	return token, hex.EncodeToString(hashBytes[:]), tokenPrefix, nil
}

func intValue(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}

func intValueDefault(value *int, fallback int) int {
	if value == nil {
		return fallback
	}
	return *value
}
