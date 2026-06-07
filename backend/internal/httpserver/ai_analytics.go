package httpserver

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type aiTransactionPayload struct {
	Text     string `json:"text"`
	RawInput string `json:"raw_input"`
	Merchant string `json:"merchant"`
	Note     string `json:"note"`
	Amount   any    `json:"amount"`
}

func (s *Server) registerAIAndAnalytics(mux *http.ServeMux) {
	mux.HandleFunc("POST /ai/extract-transaction", s.handleAIExtractTransaction)
	mux.HandleFunc("POST /ai/categorize-transaction", s.handleAICategorizeTransaction)

	mux.HandleFunc("GET /analytics/summary", s.handleAnalyticsSummary)
	mux.HandleFunc("GET /analytics/cashflow", s.handleAnalyticsCashflow)
	mux.HandleFunc("GET /analytics/spending-by-category", s.handleAnalyticsSpendingByCategory)
	mux.HandleFunc("GET /analytics/spending-by-tags", s.handleAnalyticsSpendingByTags)
	mux.HandleFunc("GET /analytics/wallet-balances", s.handleAnalyticsWalletBalances)
	mux.HandleFunc("GET /analytics/reimbursements", s.handleAnalyticsReimbursements)
}

func (s *Server) handleAIExtractTransaction(w http.ResponseWriter, r *http.Request) {
	var payload aiTransactionPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	input := firstNonBlank(payload.Text, payload.RawInput, payload.Note, payload.Merchant)
	if input == "" {
		writeError(w, http.StatusBadRequest, "text or raw_input is required")
		return
	}
	prompt := `Extract a personal finance transaction from the text below. Return only compact JSON with keys: transaction_at, merchant, amount, type, wallet_hint, category_hint, note, confidence. Use type income or expense unless transfer is clear. Text: ` + input
	result, err := callGemini(r, prompt)
	if err != nil {
		if isGeminiKeyMissing(err) && appEnv() == "development" {
			writeJSON(w, http.StatusOK, map[string]any{
				"provider": "local_fallback",
				"status":   "needs_review",
				"result":   fallbackExtractTransaction(input),
			})
			return
		}
		if isGeminiKeyMissing(err) {
			writeError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"provider": "gemini",
		"result":   result,
	})
}

func (s *Server) handleAICategorizeTransaction(w http.ResponseWriter, r *http.Request) {
	var payload aiTransactionPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	input := strings.ToLower(firstNonBlank(payload.Text, payload.RawInput, payload.Note, payload.Merchant))
	if input == "" {
		writeError(w, http.StatusBadRequest, "text, raw_input, merchant, or note is required")
		return
	}
	if category := ruleBasedCategory(input); category != "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"strategy":   "rule_based",
			"category":   category,
			"confidence": 0.8,
		})
		return
	}
	prompt := `Categorize this personal finance transaction. Return only compact JSON with keys: category, type, confidence, reason. Transaction: ` + input
	result, err := callGemini(r, prompt)
	if err != nil {
		if isGeminiKeyMissing(err) {
			writeJSON(w, http.StatusOK, map[string]any{
				"strategy":   "fallback",
				"category":   "Uncategorized",
				"status":     "needs_review",
				"confidence": 0,
			})
			return
		}
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"strategy": "gemini",
		"result":   result,
	})
}

func (s *Server) handleAnalyticsSummary(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	s.writeQueryJSON(w, r, http.StatusOK, `
		select jsonb_build_object(
			'period', jsonb_build_object('from', $2::timestamptz, 'to', $3::timestamptz),
			'basis', 'approved_only',
			'income', coalesce(sum(amount) filter (where type = 'income'), 0),
			'expense', coalesce(sum(amount) filter (where type = 'expense'), 0),
			'transfer', coalesce(sum(amount) filter (where type = 'transfer'), 0),
			'net_cashflow',
				coalesce(sum(case when type = 'income' then amount when type = 'expense' then -amount else 0 end), 0),
			'inbox', (
				select jsonb_build_object(
					'basis', 'pending_plus_needs_review',
					'count', count(*),
					'amount', coalesce(sum(amount), 0)
				)
				from transactions
				where user_id = $1 and deleted_at is null and status in ('pending', 'needs_review')
			),
			'forecast', (
				select jsonb_build_object(
					'basis', 'approved_plus_pending',
					'income', coalesce(sum(amount) filter (where type = 'income'), 0),
					'expense', coalesce(sum(amount) filter (where type = 'expense'), 0)
				)
				from transactions
				where user_id = $1 and deleted_at is null and status in ('approved', 'pending') and transaction_at >= $2 and transaction_at < $3
			)
		)
		from transactions
		where user_id = $1 and deleted_at is null and status = 'approved' and transaction_at >= $2 and transaction_at < $3
	`, userID(r), from, to)
}

func (s *Server) handleAnalyticsCashflow(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(row order by day), '[]'::jsonb)
		from (
			select date_trunc('day', transaction_at)::date as day,
				coalesce(sum(amount) filter (where type = 'income'), 0) as income,
				coalesce(sum(amount) filter (where type = 'expense'), 0) as expense,
				'approved_only' as basis
			from transactions
			where user_id = $1 and deleted_at is null and status = 'approved' and transaction_at >= $2 and transaction_at < $3
			group by day
		) row
	`, userID(r), from, to)
}

func (s *Server) handleAnalyticsSpendingByCategory(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(row order by amount desc), '[]'::jsonb)
		from (
			select c.id, c.name, sum(t.amount) as amount, 'approved_only' as basis
			from transactions t
			left join categories c on c.id = t.category_id
			where t.user_id = $1 and t.deleted_at is null and t.status = 'approved' and t.type = 'expense' and t.transaction_at >= $2 and t.transaction_at < $3
			group by c.id, c.name
		) row
	`, userID(r), from, to)
}

func (s *Server) handleAnalyticsSpendingByTags(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(row order by amount desc), '[]'::jsonb)
		from (
			select tags.id, tags.name, sum(t.amount) as amount, 'approved_only' as basis
			from transactions t
			join transaction_tags tt on tt.transaction_id = t.id and tt.deleted_at is null
			join tags on tags.id = tt.tag_id and tags.deleted_at is null
			where t.user_id = $1 and t.deleted_at is null and t.status = 'approved' and t.type = 'expense' and t.transaction_at >= $2 and t.transaction_at < $3
			group by tags.id, tags.name
		) row
	`, userID(r), from, to)
}

func (s *Server) handleAnalyticsWalletBalances(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(wb) order by wb.name), '[]'::jsonb)
		from wallet_balances wb
		where wb.user_id = $1
	`, userID(r))
}

func (s *Server) handleAnalyticsReimbursements(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select jsonb_build_object(
			'basis', 'approved_only',
			'items', coalesce(jsonb_agg(to_jsonb(t) order by t.transaction_at desc), '[]'::jsonb),
			'total_receivable', coalesce(sum(t.amount) filter (where reimbursement_status in ('receivable', 'partially_reimbursed')), 0),
			'total_reimbursed', coalesce(sum(t.amount) filter (where reimbursement_status = 'reimbursed'), 0)
		)
		from transactions t
		where t.user_id = $1 and t.deleted_at is null and t.status = 'approved' and (t.is_reimbursement = true or t.reimbursement_status <> 'none')
	`, userID(r))
}

func callGemini(r *http.Request, prompt string) (any, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if strings.TrimSpace(apiKey) == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not configured")
	}
	requestBody := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]string{{"text": prompt}}},
		},
		"generationConfig": map[string]any{
			"temperature": 0.1,
		},
	}
	body, _ := json.Marshal(requestBody)
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey
	request, err := http.NewRequestWithContext(r.Context(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("gemini request failed with status %d", response.StatusCode)
	}
	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(responseBody, &parsed); err != nil {
		return nil, err
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("gemini returned no content")
	}
	return parseGeminiJSON(parsed.Candidates[0].Content.Parts[0].Text), nil
}

func parseGeminiJSON(value string) any {
	cleaned := strings.TrimSpace(value)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)
	var parsed any
	if err := json.Unmarshal([]byte(cleaned), &parsed); err == nil {
		return parsed
	}
	return map[string]any{"raw_text": strings.TrimSpace(value)}
}

func isGeminiKeyMissing(err error) bool {
	return err != nil && strings.Contains(err.Error(), "GEMINI_API_KEY is not configured")
}

func fallbackExtractTransaction(input string) map[string]any {
	lower := strings.ToLower(input)
	amount := fallbackAmount(lower)
	transactionType := "expense"
	if strings.Contains(lower, "gaji") || strings.Contains(lower, "salary") || strings.Contains(lower, "income") {
		transactionType = "income"
	}
	return map[string]any{
		"transaction_at": time.Now().UTC().Format(time.RFC3339),
		"merchant":       fallbackMerchant(input),
		"amount":         amount,
		"type":           transactionType,
		"category_hint":  ruleBasedCategory(lower),
		"note":           input,
		"confidence":     0.25,
	}
}

func fallbackAmount(input string) float64 {
	amountPattern := regexp.MustCompile(`(?i)(?:rp\s*)?([0-9][0-9\.\,]*)(\s?k)?`)
	matches := amountPattern.FindStringSubmatch(input)
	if len(matches) < 2 {
		return 0
	}
	raw := strings.ReplaceAll(matches[1], ".", "")
	raw = strings.ReplaceAll(raw, ",", "")
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0
	}
	if len(matches) >= 3 && strings.TrimSpace(strings.ToLower(matches[2])) == "k" {
		value *= 1000
	}
	return value
}

func fallbackMerchant(input string) string {
	words := strings.Fields(input)
	if len(words) == 0 {
		return ""
	}
	if len(words) > 3 {
		words = words[:3]
	}
	return strings.Join(words, " ")
}

func ruleBasedCategory(input string) string {
	rules := map[string]string{
		"food": "Food", "makan": "Food", "kopi": "Food", "coffee": "Food", "restaurant": "Food",
		"gojek": "Transport", "grab": "Transport", "parkir": "Transport", "gas": "Gas", "bensin": "Gas",
		"subscription": "Subscription", "netflix": "Subscription", "spotify": "Subscription",
		"pln": "Bills", "internet": "Bills", "listrik": "Bills",
		"salary": "Salary", "gaji": "Salary", "freelance": "Freelance",
		"reimburse": "Reimbursement", "reimbursement": "Reimbursement",
	}
	for keyword, category := range rules {
		if strings.Contains(input, keyword) {
			return category
		}
	}
	return ""
}

func dateRange(r *http.Request) (string, string) {
	now := time.Now()
	from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)
	if value := r.URL.Query().Get("from"); value != "" {
		if parsed, err := time.Parse(time.RFC3339, value); err == nil {
			from = parsed
		} else if parsed, err := time.Parse("2006-01-02", value); err == nil {
			from = parsed
		}
	}
	if value := r.URL.Query().Get("to"); value != "" {
		if parsed, err := time.Parse(time.RFC3339, value); err == nil {
			to = parsed
		} else if parsed, err := time.Parse("2006-01-02", value); err == nil {
			to = parsed
		}
	}
	return from.Format(time.RFC3339), to.Format(time.RFC3339)
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
