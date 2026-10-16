package gmail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

type GeminiReceiptDraft struct {
	Type                  string `json:"type"`                    // "income", "expense", "transfer"
	Amount                string `json:"amount"`                  // e.g. "50000.00" or "50.000"
	TransactionAt         string `json:"transaction_at"`         // e.g. "2026-10-14T10:00:00Z" or "14/10/2026"
	MerchantOrSender      string `json:"merchant_or_sender"`
	ProviderSlug          string `json:"provider_slug"`           // "cimb", "gopay", "ovo", "shopeepay", "dana", "bank"
	IsInternalTransfer    bool   `json:"is_internal_transfer"`
	DestinationWalletHint string `json:"destination_wallet_hint"` // e.g. "gopay"
	Notes                 string `json:"notes"`
}

// FallbackParse invokes Gemini Flash to extract structured receipt data from financial email text
func FallbackParse(ctx context.Context, rawText, sender, subject string) (Receipt, error) {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		// Heuristic local fallback for development/test environments
		return heuristicFallbackParse(rawText, sender, subject)
	}

	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	model = strings.TrimPrefix(model, "models/")
	if model == "" {
		model = "gemini-2.5-flash"
	}

	prompt := fmt.Sprintf(`Anda adalah parser cerdas transaksi keuangan dari email perbankan dan dompet digital (e-wallet) Indonesia.
Analisis email berikut dan ekstrak informasinya dalam format JSON murni:

Pengirim: %s
Subjek: %s
Isi Email:
%s

Aturan:
1. "type": gunakan "income" (jika transfer masuk/uang masuk/kredit), "expense" (jika bayar belanja/debit/qris/beli makanan/tagihan), atau "transfer" (jika top-up saldo e-wallet atau mutasi antar rekening sendiri).
2. "is_internal_transfer": set true jika ini adalah isi saldo, top-up e-wallet dari bank, atau transfer antar rekening sendiri.
3. "destination_wallet_hint": jika is_internal_transfer true, sebutkan slug dompet tujuan (misal "gopay", "ovo", "shopeepay", "dana").
4. "provider_slug": sebutkan provider utama ("cimb", "gopay", "ovo", "shopeepay", "dana", "bca", "mandiri").
5. "amount": nominal dalam format angka desimal tanpa tanda mata uang (contoh: "75000.00").
6. "merchant_or_sender": nama merchant (toko) atau pengirim transfer.
7. "transaction_at": tanggal dan waktu transaksi (format ISO 8601 atau YYYY-MM-DDTHH:mm:ssZ).`, sender, subject, rawText)

	requestBody := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]any{{"text": prompt}}},
		},
		"generationConfig": map[string]any{
			"temperature":      0.1,
			"responseMimeType": "application/json",
		},
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return Receipt{}, err
	}

	urlStr := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", model)
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, urlStr, bytes.NewReader(bodyBytes))
	if err != nil {
		return Receipt{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", apiKey)

	client := &http.Client{Timeout: 35 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return Receipt{}, fmt.Errorf("gemini_request_failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Receipt{}, fmt.Errorf("gemini_api_error_%d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var parsedResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(respBytes, &parsedResp); err != nil || len(parsedResp.Candidates) == 0 || len(parsedResp.Candidates[0].Content.Parts) == 0 {
		return Receipt{}, fmt.Errorf("gemini_empty_response")
	}

	jsonText := strings.TrimSpace(parsedResp.Candidates[0].Content.Parts[0].Text)
	var draft GeminiReceiptDraft
	if err := json.Unmarshal([]byte(jsonText), &draft); err != nil {
		return Receipt{}, fmt.Errorf("invalid_gemini_json_payload: %w", err)
	}

	formattedAmount, err := parseAmount(draft.Amount)
	if err != nil {
		return Receipt{}, fmt.Errorf("gemini_invalid_amount: %w", err)
	}

	txTime, dateOnly, err := parseDate(draft.TransactionAt)
	if err != nil {
		txTime = time.Now()
		dateOnly = false
	}

	txType := strings.ToLower(strings.TrimSpace(draft.Type))
	if txType != "income" && txType != "transfer" {
		txType = "expense"
	}
	if draft.IsInternalTransfer {
		txType = "transfer"
	}

	return Receipt{
		Type:                  txType,
		Amount:                formattedAmount,
		TransactionAt:         txTime,
		DateOnly:              dateOnly,
		MerchantOrSender:      draft.MerchantOrSender,
		ProviderSlug:          draft.ProviderSlug,
		DestinationWalletHint: draft.DestinationWalletHint,
		IsInternalTransfer:    draft.IsInternalTransfer,
		Note:                  draft.Notes,
		Source:                "gemini_fallback",
	}, nil
}

// heuristicFallbackParse extracts data when GEMINI_API_KEY is omitted in local development
func heuristicFallbackParse(text, sender, subject string) (Receipt, error) {
	lowerText := strings.ToLower(text)
	lowerSubj := strings.ToLower(subject)
	lowerSender := strings.ToLower(sender)

	txType := "expense"
	isTopUp := false
	destHint := ""
	provider := "bank"

	if strings.Contains(lowerSender, "cimb") {
		provider = "cimb"
	} else if strings.Contains(lowerSender, "gojek") || strings.Contains(lowerSender, "gopay") {
		provider = "gopay"
	} else if strings.Contains(lowerSender, "ovo") {
		provider = "ovo"
	} else if strings.Contains(lowerSender, "shopee") {
		provider = "shopeepay"
	} else if strings.Contains(lowerSender, "dana") {
		provider = "dana"
	}

	if strings.Contains(lowerSubj, "top up") || strings.Contains(lowerSubj, "isi saldo") || strings.Contains(lowerText, "top up") {
		txType = "transfer"
		isTopUp = true
		destHint = provider
	} else if strings.Contains(lowerSubj, "incoming") || strings.Contains(lowerSubj, "masuk") || strings.Contains(lowerSubj, "terima dana") || strings.Contains(lowerText, "dana masuk") {
		txType = "income"
	}

	// Simple regex for amounts like Rp 50.000 or 50.000,00
	amtRegex := regexp.MustCompile(`(?i)(?:rp\.?|idr)\s*([0-9\.,]+)`)
	matches := amtRegex.FindStringSubmatch(text)
	amountStr := "0.00"
	if len(matches) > 1 {
		if amt, err := parseAmount(matches[1]); err == nil {
			amountStr = amt
		}
	}
	if amountStr == "0.00" {
		return Receipt{}, fmt.Errorf("heuristic_amount_not_found")
	}

	return Receipt{
		Type:                  txType,
		Amount:                amountStr,
		TransactionAt:         time.Now(),
		DateOnly:              false,
		MerchantOrSender:      subject,
		ProviderSlug:          provider,
		DestinationWalletHint: destHint,
		IsInternalTransfer:    isTopUp,
		Note:                  "Ekstraksi heuristik email lokal",
		Source:                "heuristic_fallback",
	}, nil
}
