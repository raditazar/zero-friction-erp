package httpserver

import (
	"net/http"
	"testing"
)

func TestFloatFromAnyParsesLocalizedAmounts(t *testing.T) {
	tests := map[string]float64{
		"Rp 25.000":    25000,
		"Rp 25.000,00": 25000,
		"25,000":       25000,
		"25,50":        25.5,
		"1.250.000,75": 1250000.75,
		"Rp8.000.000":  8000000,
	}

	for input, expected := range tests {
		t.Run(input, func(t *testing.T) {
			if got := floatFromAny(input); got != expected {
				t.Fatalf("expected %v, got %v", expected, got)
			}
		})
	}
}

func TestAmountFromTextParsesIndonesianShorthand(t *testing.T) {
	tests := map[string]float64{
		"Bayar kopi 38k":                        38000,
		"Parkir 8rb":                            8000,
		"Makan 12 ribu":                         12000,
		"Gaji 8jt":                              8000000,
		"Gaji 8 juta":                           8000000,
		"Bonus 1,5 juta":                        1500000,
		"Investasi 2 miliar":                    2000000000,
		"Gaji masuk Rp8.000.000 ke Main Bank":   8000000,
		"8 Juni 2026 bayar Roti O 27k dari OCR": 27000,
	}

	for input, expected := range tests {
		t.Run(input, func(t *testing.T) {
			if got := amountFromText(input); got != expected {
				t.Fatalf("expected %v, got %v", expected, got)
			}
		})
	}
}

func TestAmountFromExtractionPrefersRawTextWhenGeminiMisreadsRupiah(t *testing.T) {
	extracted := map[string]any{"amount": float64(8000000000)}
	got := amountFromExtraction("Gaji masuk Rp8.000.000 ke Main Bank hari ini", extracted)
	if got != 8000000 {
		t.Fatalf("expected raw text amount correction, got %v", got)
	}
}

func TestAmountFromExtractionPreservesGeminiWhenReferenceNumberPresent(t *testing.T) {
	rawInput := `Sukses!
Pembayaran ke OCTO
NOMINAL IDR 50,000º0
Tambal Ban Pak Gendut
ID Transaksi 001334580561
Waktu Transaksi 13 Agu 2026 19:34
Nomor Referensi MB13080285919355`

	extracted := map[string]any{"amount": float64(50000)}
	got := amountFromExtraction(rawInput, extracted)
	if got != 50000 {
		t.Fatalf("expected 50000 to be preserved, got %v", got)
	}
}

func TestUnwrapTransactionResult(t *testing.T) {
	wrapped := map[string]any{
		"transaction": map[string]any{
			"merchant": "Kopi",
		},
	}

	got := unwrapTransactionResult(wrapped)
	if got["merchant"] != "Kopi" {
		t.Fatalf("expected nested transaction map, got %#v", got)
	}
}

func TestClampConfidence(t *testing.T) {
	if got := clampConfidence(1.4); got != 1 {
		t.Fatalf("expected upper clamp, got %v", got)
	}
	if got := clampConfidence(-0.2); got != 0 {
		t.Fatalf("expected lower clamp, got %v", got)
	}
	if got := clampConfidence(0.72); got != 0.72 {
		t.Fatalf("expected passthrough, got %v", got)
	}
}

func TestDetectInputSource(t *testing.T) {
	tests := []struct {
		name      string
		headerKey string
		headerVal string
		userAgent string
		payload   aiTransactionPayload
		want      string
	}{
		{
			name:    "default fallback to ai",
			payload: aiTransactionPayload{},
			want:    "ai",
		},
		{
			name:      "header X-Source: ios",
			headerKey: "X-Source",
			headerVal: "ios",
			payload:   aiTransactionPayload{},
			want:      "ios",
		},
		{
			name:      "header X-Source: IOS uppercase",
			headerKey: "X-Source",
			headerVal: "IOS",
			payload:   aiTransactionPayload{},
			want:      "ios",
		},
		{
			name:      "header X-Input-Source: ios",
			headerKey: "X-Input-Source",
			headerVal: "ios",
			payload:   aiTransactionPayload{},
			want:      "ios",
		},
		{
			name:    "payload source: ios",
			payload: aiTransactionPayload{Source: "ios"},
			want:    "ios",
		},
		{
			name:    "payload input_source: ios",
			payload: aiTransactionPayload{InputSource: "ios"},
			want:    "ios",
		},
		{
			name:    "payload source: ios_shortcut_ocr",
			payload: aiTransactionPayload{Source: "ios_shortcut_ocr"},
			want:    "ios",
		},
		{
			name:      "user-agent contains Shortcuts",
			userAgent: "Shortcuts/1145.10 CFNetwork/1410.0.3 Darwin/22.4.0",
			payload:   aiTransactionPayload{},
			want:      "ios",
		},
		{
			name:      "user-agent contains CFNetwork only",
			userAgent: "CFNetwork/1408.0.4 Darwin/22.5.0",
			payload:   aiTransactionPayload{},
			want:      "ios",
		},
		{
			name:    "payload explicit custom source e.g. api",
			payload: aiTransactionPayload{Source: "api"},
			want:    "api",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPost, "/ai/extract-transaction", nil)
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}
			if tt.headerKey != "" {
				req.Header.Set(tt.headerKey, tt.headerVal)
			}
			if tt.userAgent != "" {
				req.Header.Set("User-Agent", tt.userAgent)
			}
			got := detectInputSource(req, tt.payload)
			if got != tt.want {
				t.Fatalf("detectInputSource() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDetectInputMode(t *testing.T) {
	req, _ := http.NewRequest(http.MethodPost, "/ai/extract-transaction", nil)
	if got := detectInputMode(req, aiTransactionPayload{}); got != "text" {
		t.Fatalf("expected text mode, got %v", got)
	}
	if got := detectInputMode(req, aiTransactionPayload{ImageBase64: "data..."}); got != "ocr" {
		t.Fatalf("expected ocr mode for image, got %v", got)
	}
	if got := detectInputMode(req, aiTransactionPayload{InputMode: "screenshot"}); got != "screenshot" {
		t.Fatalf("expected screenshot mode, got %v", got)
	}
}

func TestFormatRupiah(t *testing.T) {
	tests := map[float64]string{
		50000:   "Rp 50.000",
		8000000: "Rp 8.000.000",
		25000:   "Rp 25.000",
		12345:   "Rp 12.345",
		500:     "Rp 500",
		0:       "Rp 0",
		50000.5: "Rp 50.000,50",
	}

	for amount, expected := range tests {
		if got := formatRupiah(amount); got != expected {
			t.Fatalf("formatRupiah(%v) = %v, want %v", amount, got, expected)
		}
	}
}

func TestGenerateSummaryMessage(t *testing.T) {
	tests := []struct {
		amount   float64
		merchant string
		want     string
	}{
		{
			amount:   50000,
			merchant: "Alfamart",
			want:     "Berhasil masuk inbox: Rp 50.000 di Alfamart",
		},
		{
			amount:   25000,
			merchant: "Kopi Kenangan",
			want:     "Berhasil masuk inbox: Rp 25.000 di Kopi Kenangan",
		},
		{
			amount:   8000000,
			merchant: "",
			want:     "Berhasil masuk inbox: Rp 8.000.000",
		},
	}

	for _, tt := range tests {
		got := generateSummaryMessage(tt.amount, tt.merchant)
		if got != tt.want {
			t.Fatalf("generateSummaryMessage(%v, %q) = %v, want %v", tt.amount, tt.merchant, got, tt.want)
		}
	}
}
