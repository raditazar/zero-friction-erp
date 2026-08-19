package httpserver

import (
	"bytes"
	"context"
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
	Text        string `json:"text"`
	RawInput    string `json:"raw_input"`
	ImageBase64 string `json:"image_base64"`
	ImageMime   string `json:"image_mime"`
	Merchant    string `json:"merchant"`
	Note        string `json:"note"`
	Amount      any    `json:"amount"`
	Source      string `json:"source"`
	InputSource string `json:"input_source"`
	InputMode   string `json:"input_mode"`
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
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	input := firstNonBlank(payload.Text, payload.RawInput, payload.Note, payload.Merchant)
	if input == "" && strings.TrimSpace(payload.ImageBase64) != "" {
		input = "Ekstraksi transaksi dari foto struk belanja"
	}
	if input == "" {
		writeError(w, http.StatusBadRequest, "text, raw_input, or image_base64 is required")
		return
	}
	if _, err := s.ensureStarterWorkspace(r, userID(r)); err != nil {
		s.writeDBError(w, err)
		return
	}
	contextJSON, err := s.aiExtractionContext(r)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	prompt := aiExtractionPrompt(input, string(contextJSON))
	provider := "gemini"
	result, err := callGemini(r, prompt, payload.ImageBase64, payload.ImageMime)
	if err != nil {
		if isGeminiKeyMissing(err) && appEnv() == "development" {
			provider = "local_fallback"
			result = fallbackExtractTransaction(input)
		} else if isGeminiKeyMissing(err) {
			writeError(w, http.StatusServiceUnavailable, err.Error())
			return
		} else {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
	}
	inputSource := detectInputSource(r, payload)
	inputMode := detectInputMode(r, payload)
	transaction, amount, merchant, err := s.createAITransactionDraft(r, input, result, inputSource, inputMode)
	if err != nil {
		if strings.Contains(err.Error(), "could not extract a positive amount") {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		s.writeDBError(w, err)
		return
	}
	summaryMessage := generateSummaryMessage(amount, merchant)
	writeJSON(w, http.StatusCreated, map[string]any{
		"provider":        provider,
		"status":          "needs_review",
		"result":          result,
		"transaction":     transaction,
		"summary_message": summaryMessage,
	})
}

func (s *Server) handleWebhookAIExtraction(w http.ResponseWriter, r *http.Request, body []byte, idempotencyText string, eventJSON json.RawMessage) bool {
	var aiPayload aiTransactionPayload
	if err := json.Unmarshal(body, &aiPayload); err != nil {
		return false
	}
	input := firstNonBlank(aiPayload.Text, aiPayload.RawInput, aiPayload.Note, aiPayload.Merchant)
	if input == "" && strings.TrimSpace(aiPayload.ImageBase64) != "" {
		input = "Ekstraksi transaksi dari foto struk belanja"
	}
	if input == "" && strings.TrimSpace(aiPayload.ImageBase64) == "" {
		return false
	}

	if _, err := s.ensureStarterWorkspace(r, userID(r)); err != nil {
		s.writeDBError(w, err)
		return true
	}
	contextJSON, err := s.aiExtractionContext(r)
	if err != nil {
		s.writeDBError(w, err)
		return true
	}
	prompt := aiExtractionPrompt(input, string(contextJSON))
	provider := "gemini"
	result, err := callGemini(r, prompt, aiPayload.ImageBase64, aiPayload.ImageMime)
	if err != nil {
		if isGeminiKeyMissing(err) && appEnv() == "development" {
			provider = "local_fallback"
			result = fallbackExtractTransaction(input)
		} else if isGeminiKeyMissing(err) {
			writeError(w, http.StatusServiceUnavailable, err.Error())
			return true
		} else {
			writeError(w, http.StatusBadGateway, err.Error())
			return true
		}
	}
	inputSource := detectInputSource(r, aiPayload)
	inputMode := detectInputMode(r, aiPayload)
	transaction, amount, merchant, err := s.createAITransactionDraft(r, input, result, inputSource, inputMode)
	if err != nil {
		if strings.Contains(err.Error(), "could not extract a positive amount") {
			writeError(w, http.StatusBadRequest, err.Error())
			return true
		}
		s.writeDBError(w, err)
		return true
	}

	var ignoredID string
	_ = s.db.QueryRow(r.Context(), `
		update webhook_events
		set status = 'processed'
		where user_id = $1 and idempotency_text = $2
		returning id
	`, userID(r), idempotencyText).Scan(&ignoredID)

	summaryMessage := generateSummaryMessage(amount, merchant)
	writeJSON(w, http.StatusAccepted, map[string]any{
		"status":          "accepted",
		"provider":        provider,
		"webhook_event":   eventJSON,
		"transaction":     transaction,
		"summary_message": summaryMessage,
	})
	return true
}

func detectInputSource(r *http.Request, payload aiTransactionPayload) string {
	headerSource := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Source")))
	if headerSource == "" {
		headerSource = strings.ToLower(strings.TrimSpace(r.Header.Get("X-Input-Source")))
	}
	payloadSource := strings.ToLower(strings.TrimSpace(firstNonBlank(payload.Source, payload.InputSource)))
	userAgent := strings.ToLower(r.UserAgent())

	if strings.Contains(headerSource, "ios") ||
		strings.Contains(payloadSource, "ios") ||
		strings.Contains(userAgent, "shortcuts") ||
		strings.Contains(userAgent, "cfnetwork") {
		return "ios"
	}
	if payloadSource != "" {
		return payloadSource
	}
	return "ai"
}

func detectInputMode(r *http.Request, payload aiTransactionPayload) string {
	if strings.TrimSpace(payload.InputMode) != "" {
		return strings.TrimSpace(payload.InputMode)
	}
	if strings.TrimSpace(payload.ImageBase64) != "" {
		return "ocr"
	}
	return "text"
}

func formatRupiah(amount float64) string {
	sign := ""
	if amount < 0 {
		sign = "-"
		amount = -amount
	}
	intPart := int64(amount)
	decPart := amount - float64(intPart)

	s := strconv.FormatInt(intPart, 10)
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	if len(s) > 0 {
		parts = append([]string{s}, parts...)
	}
	formattedInt := strings.Join(parts, ".")
	if formattedInt == "" {
		formattedInt = "0"
	}
	if decPart >= 0.005 {
		decStr := fmt.Sprintf("%.2f", decPart)
		decStr = strings.TrimPrefix(decStr, "0.")
		return fmt.Sprintf("%sRp %s,%s", sign, formattedInt, decStr)
	}
	return fmt.Sprintf("%sRp %s", sign, formattedInt)
}

func generateSummaryMessage(amount float64, merchant string) string {
	formattedAmount := formatRupiah(amount)
	merchant = strings.TrimSpace(merchant)
	if merchant != "" {
		return fmt.Sprintf("Berhasil masuk inbox: %s di %s", formattedAmount, merchant)
	}
	return fmt.Sprintf("Berhasil masuk inbox: %s", formattedAmount)
}

func (s *Server) createAITransactionDraft(r *http.Request, rawInput string, result any, inputSource string, inputMode string) (json.RawMessage, float64, string, error) {
	extracted, _ := result.(map[string]any)
	extracted = unwrapTransactionResult(extracted)
	transactionType := normalizedTransactionType(stringFromAny(extracted["type"]))
	amount := amountFromExtraction(rawInput, extracted)
	if amount <= 0 {
		return nil, 0, "", fmt.Errorf("could not extract a positive amount")
	}
	walletID, err := s.bestWalletID(r, stringFromAny(extracted["wallet_hint"]))
	if err != nil {
		return nil, 0, "", err
	}
	var destinationWalletID *string
	categoryID := ""
	if transactionType == "transfer" {
		destHint := firstNonBlank(
			stringFromAny(extracted["destination_wallet_hint"]),
			stringFromAny(extracted["destination_hint"]),
			stringFromAny(extracted["destination_wallet"]),
			stringFromAny(extracted["merchant"]),
		)
		if destID, err := s.bestDestinationWalletID(r, walletID, destHint); err == nil && destID != "" {
			destinationWalletID = &destID
		} else {
			// If no secondary wallet is found, safely fallback to expense so the draft
			// can be saved in Inbox for review without violating the DB check constraint.
			transactionType = "expense"
			categoryID, _ = s.bestCategoryID(r, transactionType, stringFromAny(extracted["category_hint"]))
		}
	} else {
		categoryID, _ = s.bestCategoryID(r, transactionType, stringFromAny(extracted["category_hint"]))
	}
	transactionAt := time.Now().UTC().Format(time.RFC3339)
	if parsed := stringFromAny(extracted["transaction_at"]); parsed != "" {
		transactionAt = parsed
	}
	status := "needs_review"
	source := inputSource
	if source == "" {
		source = "ai"
	}
	mode := inputMode
	if mode == "" {
		mode = "text"
	}
	confidence := clampConfidence(floatFromAny(extracted["confidence"]))
	merchantName := firstNonBlank(stringFromAny(extracted["merchant"]), fallbackMerchant(rawInput))
	payload := transactionPayload{
		WalletID:            &walletID,
		DestinationWalletID: destinationWalletID,
		Type:                &transactionType,
		Status:              &status,
		TransactionAt:       &transactionAt,
		Merchant:            stringPointer(merchantName),
		Amount:              &amount,
		CategoryID:          optionalStringPointer(categoryID),
		Note:                stringPointer(firstNonBlank(stringFromAny(extracted["note"]), rawInput)),
		InputSource:         &source,
		InputMode:           &mode,
		RawInput:            &rawInput,
		AIConfidence:        &confidence,
		IsReimbursement:     boolPointer(strings.Contains(strings.ToLower(rawInput), "reimburse")),
	}
	if payload.IsReimbursement != nil && *payload.IsReimbursement {
		reimbursementStatus := "receivable"
		payload.ReimbursementStatus = &reimbursementStatus
	}
	normalizeTransactionPayload(&payload)
	var transactionJSON json.RawMessage
	err = s.db.QueryRow(r.Context(), createTransactionSQL(), transactionArgs(userID(r), payload, transactionAt)...).Scan(&transactionJSON)
	return transactionJSON, amount, merchantName, err
}

func (s *Server) aiExtractionContext(r *http.Request) (json.RawMessage, error) {
	var payload json.RawMessage
	err := s.db.QueryRow(r.Context(), `
		select jsonb_build_object(
			'current_time', $2::timestamptz,
			'wallets', (
				select coalesce(jsonb_agg(jsonb_build_object(
					'id', w.id,
					'name', w.name,
					'category', w.category,
					'provider', w.provider
				) order by w.created_at), '[]'::jsonb)
				from wallets w
				where w.user_id = $1 and w.deleted_at is null
			),
			'categories', (
				select coalesce(jsonb_agg(jsonb_build_object(
					'id', c.id,
					'name', c.name,
					'type', c.type
				) order by c.type, c.name), '[]'::jsonb)
				from categories c
				where c.user_id = $1 and c.deleted_at is null
			)
		)
	`, userID(r), time.Now().UTC().Format(time.RFC3339)).Scan(&payload)
	return payload, err
}

func aiExtractionPrompt(input, contextJSON string) string {
	return `Extract one personal finance transaction from the raw text.
Return only compact JSON. No markdown.
Required keys: transaction_at, merchant, amount, type, wallet_hint, category_hint, note, confidence.
Use type income, expense, transfer, or adjustment. Prefer expense unless income or transfer is clear.
Use transaction_at as ISO 8601/RFC3339 string with timezone offset +07:00 (WIB) when date/time is explicit (e.g. "13 Agu 2026 19:34" -> "2026-08-13T19:34:00+07:00"). If date/time is not explicit, use the current_time from context.
For Indonesian Rupiah, parse dots as thousands separators and commas as decimal separators.
Examples: Rp8.000.000 = 8000000, Rp12.345,00 = 12345 (ignore the ,00 decimal suffix for IDR), 8k/8rb/8 ribu = 8000, 8jt/8 juta = 8000000, 8 miliar = 8000000000.
Return amount as a plain numeric IDR value (number), not cents and not a formatted string. Reference numbers (Nomor Referensi), transaction IDs, account numbers, or postal codes are NOT the transaction amount.
Use wallet_hint and category_hint from the provided workspace names when possible.
Context: ` + contextJSON + `
Raw text: ` + input
}

func unwrapTransactionResult(extracted map[string]any) map[string]any {
	if extracted == nil {
		return map[string]any{}
	}
	for _, key := range []string{"transaction", "draft", "result"} {
		if nested, ok := extracted[key].(map[string]any); ok {
			return nested
		}
	}
	return extracted
}

func (s *Server) bestWalletID(r *http.Request, hint string) (string, error) {
	var id string
	err := s.db.QueryRow(r.Context(), `
		select id::text
		from wallets
		where user_id = $1 and deleted_at is null
		order by
			case
				when lower(name) = lower($2) then 0
				when lower(coalesce(provider, '')) = lower($2) then 1
				else 2
			end,
			case when is_active then 0 else 1 end,
			created_at
		limit 1
	`, userID(r), strings.TrimSpace(hint)).Scan(&id)
	return id, err
}

func (s *Server) bestDestinationWalletID(r *http.Request, sourceWalletID string, hint string) (string, error) {
	var id string
	err := s.db.QueryRow(r.Context(), `
		select id::text
		from wallets
		where user_id = $1 and id <> $2::uuid and deleted_at is null
		order by
			case
				when lower(name) = lower($3) then 0
				when lower(coalesce(provider, '')) = lower($3) then 1
				when lower(name) like '%' || lower($3) || '%' and $3 <> '' then 2
				else 3
			end,
			case when is_active then 0 else 1 end,
			created_at
		limit 1
	`, userID(r), sourceWalletID, strings.TrimSpace(hint)).Scan(&id)
	return id, err
}

func (s *Server) bestCategoryID(r *http.Request, transactionType string, hint string) (string, error) {
	var id string
	err := s.db.QueryRow(r.Context(), `
		select id::text
		from categories
		where user_id = $1 and deleted_at is null and type = $2::category_type
		order by
			case
				when lower(name) = lower($3) then 0
				when lower(name) like '%' || lower($3) || '%' and $3 <> '' then 1
				when lower(name) like 'other%' then 3
				else 2
			end,
			name
		limit 1
	`, userID(r), transactionType, strings.TrimSpace(hint)).Scan(&id)
	return id, err
}

func normalizedTransactionType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "income", "expense", "transfer", "adjustment":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "expense"
	}
}

func stringFromAny(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	default:
		return ""
	}
}

func floatFromAny(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case json.Number:
		parsed, _ := typed.Float64()
		return parsed
	case string:
		cleaned := regexp.MustCompile(`[^0-9\.,-]`).ReplaceAllString(strings.TrimSpace(typed), "")
		if cleaned == "" {
			return 0
		}
		dotCount := strings.Count(cleaned, ".")
		commaCount := strings.Count(cleaned, ",")

		if dotCount > 0 && commaCount > 0 {
			// e.g. "1.250.000,00" or "1,250,000.00"
			lastDot := strings.LastIndex(cleaned, ".")
			lastComma := strings.LastIndex(cleaned, ",")
			if lastComma > lastDot {
				// Indonesian style: 1.250.000,50
				cleaned = strings.ReplaceAll(cleaned, ".", "")
				cleaned = strings.ReplaceAll(cleaned, ",", ".")
			} else {
				// US style: 1,250,000.50
				cleaned = strings.ReplaceAll(cleaned, ",", "")
			}
		} else if commaCount == 1 && dotCount == 0 {
			// e.g. "25,50" (decimal) vs "25,000" (thousand)
			idx := strings.LastIndex(cleaned, ",")
			decimals := len(cleaned) - 1 - idx
			beforeComma := cleaned[:idx]
			if decimals == 3 && (len(beforeComma) >= 1 && len(beforeComma) <= 3) {
				// "25,000" -> 25000
				cleaned = strings.ReplaceAll(cleaned, ",", "")
			} else {
				// "25,50" or "25,5" -> 25.50
				cleaned = strings.ReplaceAll(cleaned, ",", ".")
			}
		} else if dotCount == 1 && commaCount == 0 {
			// e.g. "25.000" (thousand) vs "25000.00" (decimal) vs "25.50" (decimal)
			idx := strings.LastIndex(cleaned, ".")
			decimals := len(cleaned) - 1 - idx
			beforeDot := cleaned[:idx]
			if decimals == 3 && (len(beforeDot) >= 1 && len(beforeDot) <= 3) {
				// e.g. "25.000" -> 25000
				cleaned = strings.ReplaceAll(cleaned, ".", "")
			} else if decimals <= 2 || len(beforeDot) > 3 {
				// e.g. "25000.00" -> 25000.00, "25.50" -> 25.50, "250000.00" -> 250000.00
				// Keep dot as decimal point
			} else {
				cleaned = strings.ReplaceAll(cleaned, ".", "")
			}
		} else {
			// Multiple dots or multiple commas: "2.500.000" or "2,500,000"
			cleaned = strings.ReplaceAll(cleaned, ".", "")
			cleaned = strings.ReplaceAll(cleaned, ",", "")
		}
		parsed, _ := strconv.ParseFloat(cleaned, 64)
		return parsed
	default:
		return 0
	}
}

func amountFromExtraction(rawInput string, extracted map[string]any) float64 {
	extractedAmount := floatFromAny(extracted["amount"])
	if extractedAmount <= 0 {
		extractedAmount = floatFromAny(extracted["value"])
	}
	if extractedAmount <= 0 {
		extractedAmount = floatFromAny(extracted["amount_value"])
	}
	rawAmount := amountFromText(rawInput)
	if rawAmount <= 0 {
		return extractedAmount
	}
	if extractedAmount <= 0 {
		return rawAmount
	}
	if (extractedAmount >= rawAmount*100 || rawAmount >= extractedAmount*100) && (strings.Contains(strings.ToLower(rawInput), "rp") || strings.Contains(strings.ToLower(rawInput), "idr")) {
		if rawAmount > 0 && rawAmount < 10000000000 {
			return rawAmount
		}
	}
	return extractedAmount
}

func amountFromText(input string) float64 {
	pattern := regexp.MustCompile(`(?i)\b(rp\.?|idr\s*)?([0-9][0-9\.\,]*)(\s*(k|rb|ribu|jt|juta|miliar|milyar|billion|bn)\b)?`)
	matches := pattern.FindAllStringSubmatch(strings.ToLower(input), -1)
	bestAmount := float64(0)
	bestScore := -1
	for _, match := range matches {
		rawNum := strings.TrimSpace(match[2])
		hasCurrency := strings.TrimSpace(match[1]) != ""
		hasUnit := strings.TrimSpace(match[4]) != ""

		if !hasCurrency && !hasUnit {
			if len(rawNum) > 7 && !strings.ContainsAny(rawNum, ".,") {
				continue
			}
		}

		value := floatFromAny(rawNum)
		if value <= 0 {
			continue
		}
		multiplier := amountMultiplier(match[4])
		amount := value * multiplier
		if !hasCurrency && !hasUnit && amount < 1000 {
			continue
		}
		score := 0
		if hasCurrency {
			score += 10
		}
		if hasUnit {
			score += 8
		}
		if amount >= 1000 {
			score += 1
		}
		if score > bestScore || (score == bestScore && amount > bestAmount) {
			bestScore = score
			bestAmount = amount
		}
	}
	return bestAmount
}

func amountMultiplier(unit string) float64 {
	switch strings.ToLower(strings.TrimSpace(unit)) {
	case "k", "rb", "ribu":
		return 1000
	case "jt", "juta":
		return 1000000
	case "miliar", "milyar", "billion", "bn":
		return 1000000000
	default:
		return 1
	}
}

func clampConfidence(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func stringPointer(value string) *string {
	return &value
}

func optionalStringPointer(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}

func boolPointer(value bool) *bool {
	return &value
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
	result, err := callGemini(r, prompt, "", "")
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
			'expense', coalesce(sum(amount) filter (where type = 'expense' and is_reimbursement = false), 0),
			'transfer', coalesce(sum(amount) filter (where type = 'transfer'), 0),
			'net_cashflow',
				coalesce(sum(case when type = 'income' then amount when type = 'expense' and is_reimbursement = false then -amount else 0 end), 0),
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
					'expense', coalesce(sum(amount) filter (where type = 'expense' and is_reimbursement = false), 0)
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
				coalesce(sum(amount) filter (where type = 'expense' and is_reimbursement = false), 0) as expense,
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
			where t.user_id = $1 and t.deleted_at is null and t.status = 'approved' and t.type = 'expense' and t.is_reimbursement = false and t.transaction_at >= $2 and t.transaction_at < $3
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

func callGemini(r *http.Request, prompt string, imageBase64 string, imageMime string) (any, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if strings.TrimSpace(apiKey) == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not configured")
	}

	parts := make([]map[string]any, 0, 2)
	if strings.TrimSpace(imageBase64) != "" {
		mime := strings.TrimSpace(imageMime)
		if mime == "" {
			mime = "image/jpeg"
		}
		parts = append(parts, map[string]any{
			"inline_data": map[string]string{
				"mime_type": mime,
				"data":      strings.TrimSpace(imageBase64),
			},
		})
	}
	parts = append(parts, map[string]any{"text": prompt})

	requestBody := map[string]any{
		"contents": []map[string]any{
			{"parts": parts},
		},
		"generationConfig": map[string]any{
			"temperature":      0.1,
			"responseMimeType": "application/json",
		},
	}
	body, _ := json.Marshal(requestBody)
	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-2.5-flash"
	}
	urlStr := "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey
	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, urlStr, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 45 * time.Second}
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
	return amountFromText(input)
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
			if parsed.Hour() == 0 && parsed.Minute() == 0 && parsed.Second() == 0 {
				to = parsed.AddDate(0, 0, 1)
			} else {
				to = parsed
			}
		} else if parsed, err := time.Parse("2006-01-02", value); err == nil {
			to = parsed.AddDate(0, 0, 1)
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
