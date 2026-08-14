package httpserver

import "testing"

func TestFloatFromAnyParsesLocalizedAmounts(t *testing.T) {
	tests := map[string]float64{
		"Rp 25.000":    25000,
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
