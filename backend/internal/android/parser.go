package android

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// NotificationPayload merepresentasikan body JSON yang dikirimkan oleh MacroDroid
type NotificationPayload struct {
	DeviceID    string `json:"device_id"`
	AppName     string `json:"app_name"`
	PackageName string `json:"package_name"`
	Title       string `json:"title"`
	Text        string `json:"text"`
	PostedAt    string `json:"posted_at"` // Format ISO 8601 / RFC 3339
}

// ParsedNotification adalah representasi data transaksi yang berhasil diekstrak
type ParsedNotification struct {
	Amount                float64   `json:"amount"`
	Merchant              string    `json:"merchant"`
	Type                  string    `json:"type"` // "expense", "income", "transfer"
	ProviderSlug          string    `json:"provider_slug"`
	RefNumber             string    `json:"ref_number,omitempty"`
	DestinationWalletHint string    `json:"destination_wallet_hint,omitempty"`
	Note                  string    `json:"note,omitempty"`
	TransactionAt         time.Time `json:"transaction_at"`
	IsFiltered            bool      `json:"is_filtered"`
	FilterReason          string    `json:"filter_reason,omitempty"`
}

// PackageToSlug memetakan package Android ke provider_slug yang ada di basis data
var PackageToSlug = map[string]string{
	"com.gojek.app":      "gopay",
	"com.gojek.gopay":    "gopay",
	"com.cimb.octo":      "cimb",
	"com.cimbniaga.octo": "cimb",
	"com.shopeepay":      "shopeepay",
	"id.co.shopee":       "shopeepay",
	"com.blu.app":        "blu",
	"id.co.bca.blu":      "blu",
}

// promoPatterns adalah pola regex untuk pemfilteran pesan promo, OTP, dan keamanan
var promoPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(diskon|voucher|cashback|promo|kupon|gratis|reward|poin\s*kamu)`),
	regexp.MustCompile(`(?i)(kode\s*otp|verifikasi|login\s*baru|keamanan|pin\s*anda|jangan\s*berikan)`),
	regexp.MustCompile(`(?i)(selamat\s*anda|undian|hadiah|klaim\s*sekarang)`),
	regexp.MustCompile(`(?i)(saldo\s*(kamu|anda)\s*saat\s*ini|informasi\s*saldo|saldo\s+gopay\s+(kamu|anda))`),
}

// IsPromoOrSecurity memeriksa apakah notifikasi merupakan pesan non-transaksi
func IsPromoOrSecurity(title, text string) (bool, string) {
	combined := strings.TrimSpace(title + " " + text)
	for _, pattern := range promoPatterns {
		if pattern.MatchString(combined) {
			return true, "promo_or_security_filter"
		}
	}
	return false, ""
}

// Parse mengekstrak transaksi keuangan dari payload notifikasi Android
func Parse(p NotificationPayload) (ParsedNotification, error) {
	// 1. Cek filter sampah terlebih dahulu
	if filtered, reason := IsPromoOrSecurity(p.Title, p.Text); filtered {
		return ParsedNotification{
			IsFiltered:   true,
			FilterReason: reason,
		}, nil
	}

	slug := PackageToSlug[strings.ToLower(strings.TrimSpace(p.PackageName))]
	if slug == "" {
		slug = deriveSlugFromAppName(p.AppName)
	}

	postedAt := time.Now().UTC()
	if strings.TrimSpace(p.PostedAt) != "" {
		for _, layout := range []string{
			time.RFC3339,
			time.RFC3339Nano,
			"2006-01-02T15:04:05",
			"2006-01-02 15:04:05",
			"2006-01-02",
		} {
			if t, err := time.Parse(layout, strings.TrimSpace(p.PostedAt)); err == nil {
				postedAt = t
				break
			}
		}
	}

	combinedText := strings.TrimSpace(p.Title + " " + p.Text)

	switch slug {
	case "gopay":
		return parseGoPay(combinedText, postedAt)
	case "cimb":
		return parseCIMBOCTO(combinedText, postedAt)
	case "shopeepay":
		return parseShopeePay(combinedText, postedAt)
	case "blu":
		return parseBlu(combinedText, postedAt)
	default:
		return parseGeneric(combinedText, slug, postedAt)
	}
}

func deriveSlugFromAppName(appName string) string {
	norm := strings.ToLower(strings.TrimSpace(appName))
	switch {
	case strings.Contains(norm, "gopay") || strings.Contains(norm, "gojek"):
		return "gopay"
	case strings.Contains(norm, "cimb") || strings.Contains(norm, "octo"):
		return "cimb"
	case strings.Contains(norm, "shopee"):
		return "shopeepay"
	case strings.Contains(norm, "blu"):
		return "blu"
	default:
		return ""
	}
}

func parseRupiahAmount(raw string) (float64, error) {
	val := strings.TrimSpace(raw)
	rePrefix := regexp.MustCompile(`(?i)^(?:rp\.?|idr)\s*`)
	val = rePrefix.ReplaceAllString(val, "")
	val = strings.TrimSpace(val)

	// Periksa desimal di akhir e.g. "35.000,00" atau "35000,50"
	if idx := strings.LastIndex(val, ","); idx != -1 {
		fraction := val[idx+1:]
		if len(fraction) <= 2 {
			whole := val[:idx]
			whole = strings.ReplaceAll(whole, ".", "")
			whole = strings.ReplaceAll(whole, " ", "")
			combined := whole + "." + fraction
			return strconv.ParseFloat(combined, 64)
		}
	}

	clean := strings.ReplaceAll(val, ".", "")
	clean = strings.ReplaceAll(clean, " ", "")
	clean = strings.ReplaceAll(clean, ",", "")

	return strconv.ParseFloat(clean, 64)
}

func extractFirstRupiahAmount(text string) (float64, error) {
	// 1. Format dengan prefix mata uang Rp / IDR
	currRe := regexp.MustCompile(`(?i)(?:rp\.?|idr)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)`)
	matches := currRe.FindAllStringSubmatch(text, -1)
	for _, m := range matches {
		if len(m) > 1 {
			if amt, err := parseRupiahAmount(m[1]); err == nil && amt > 0 {
				return amt, nil
			}
		}
	}

	// 2. Format dengan label kontekstual
	labeledRe := regexp.MustCompile(`(?i)(?:sebesar|nominal|total|jumlah)\s*:?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+)`)
	matches = labeledRe.FindAllStringSubmatch(text, -1)
	for _, m := range matches {
		if len(m) > 1 {
			if amt, err := parseRupiahAmount(m[1]); err == nil && amt > 0 {
				return amt, nil
			}
		}
	}

	// 3. Fallback: angka pemisah ribuan
	thousandRe := regexp.MustCompile(`\b([0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]{1,2})?)\b`)
	matches = thousandRe.FindAllStringSubmatch(text, -1)
	for _, m := range matches {
		if len(m) > 1 {
			if amt, err := parseRupiahAmount(m[1]); err == nil && amt > 0 {
				return amt, nil
			}
		}
	}

	return 0, fmt.Errorf("amount not found in notification")
}

var refPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(?:ref(?:erensi)?|no(?:mor)?\.?\s*ref(?:erensi)?|ref\s*number)\s*:?\s*([a-zA-Z0-9\-_]+)`),
	regexp.MustCompile(`(?i)(?:order\s*id|id\s*transaksi|trx\s*id)\s*:?\s*([a-zA-Z0-9\-_]+)`),
}

func extractRefNumber(text string) string {
	for _, re := range refPatterns {
		m := re.FindStringSubmatch(text)
		if len(m) > 1 {
			return strings.TrimSpace(m[1])
		}
	}
	return ""
}

func extractMerchant(text string) string {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:ke|di)\s+([A-Za-z0-9\s\.\&'-]+?)(?:\s+\b(?:berhasil|sukses|pada|sebesar|rp)\b|\s+\d+|[\.,!\n]|$)`),
	}
	for _, p := range patterns {
		m := p.FindStringSubmatch(text)
		if len(m) > 1 {
			candidate := strings.TrimSpace(m[1])
			lower := strings.ToLower(candidate)
			if lower != "" && !strings.HasPrefix(lower, "rp") && !strings.Contains(lower, "berhasil") && !isGenericAccountOrWord(lower) {
				return candidate
			}
		}
	}
	return ""
}

func isGenericAccountOrWord(w string) bool {
	switch w {
	case "rekening", "akun", "bank", "nomor", "no":
		return true
	default:
		// Jika hanya angka (seperti nomor rekening)
		if _, err := strconv.Atoi(w); err == nil {
			return true
		}
		return false
	}
}

func parseGoPay(text string, postedAt time.Time) (ParsedNotification, error) {
	amt, err := extractFirstRupiahAmount(text)
	if err != nil {
		return ParsedNotification{}, err
	}

	lower := strings.ToLower(text)
	ref := extractRefNumber(text)

	// Top Up / Transfer Masuk
	if strings.Contains(lower, "top up") || strings.Contains(lower, "isi saldo") {
		note := "Top up GoPay"
		if reSource := regexp.MustCompile(`(?i)dari\s+([A-Za-z0-9\s]+?)(?:\s+berhasil|\.|$)`); reSource.MatchString(text) {
			m := reSource.FindStringSubmatch(text)
			if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
				note = "Top up GoPay dari " + strings.TrimSpace(m[1])
			}
		}
		return ParsedNotification{
			Amount:                amt,
			Type:                  "transfer",
			ProviderSlug:          "gopay",
			DestinationWalletHint: "gopay",
			RefNumber:             ref,
			Note:                  note,
			TransactionAt:         postedAt,
		}, nil
	}

	// Pembayaran ke merchant
	merchant := extractMerchant(text)
	return ParsedNotification{
		Amount:        amt,
		Merchant:      merchant,
		Type:          "expense",
		ProviderSlug:  "gopay",
		RefNumber:     ref,
		Note:          "Pembayaran GoPay",
		TransactionAt: postedAt,
	}, nil
}

func parseCIMBOCTO(text string, postedAt time.Time) (ParsedNotification, error) {
	amt, err := extractFirstRupiahAmount(text)
	if err != nil {
		return ParsedNotification{}, err
	}

	lower := strings.ToLower(text)
	ref := extractRefNumber(text)

	// Transfer keluar
	if strings.Contains(lower, "transfer") {
		note := "Transfer OCTO Mobile"
		if reDest := regexp.MustCompile(`(?i)ke\s+([A-Za-z0-9\s]+?)(?:\s+rp|\s+sebesar|\s+ref|\.|$)`); reDest.MatchString(text) {
			m := reDest.FindStringSubmatch(text)
			if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
				note = "Transfer ke " + strings.TrimSpace(m[1])
			}
		}
		return ParsedNotification{
			Amount:        amt,
			Type:          "transfer",
			ProviderSlug:  "cimb",
			RefNumber:     ref,
			Note:          note,
			TransactionAt: postedAt,
		}, nil
	}

	// Pembelian / Pembayaran QRIS / Debit
	merchant := extractMerchant(text)
	note := "Transaksi CIMB OCTO"
	if strings.Contains(lower, "qris") {
		note = "Pembayaran QRIS OCTO"
	} else if strings.Contains(lower, "pembelian") {
		note = "Pembelian OCTO"
	}

	return ParsedNotification{
		Amount:        amt,
		Merchant:      merchant,
		Type:          "expense",
		ProviderSlug:  "cimb",
		RefNumber:     ref,
		Note:          note,
		TransactionAt: postedAt,
	}, nil
}

func parseShopeePay(text string, postedAt time.Time) (ParsedNotification, error) {
	amt, err := extractFirstRupiahAmount(text)
	if err != nil {
		return ParsedNotification{}, err
	}

	lower := strings.ToLower(text)
	ref := extractRefNumber(text)

	// Top Up ShopeePay
	if strings.Contains(lower, "top up") || strings.Contains(lower, "isi saldo") {
		return ParsedNotification{
			Amount:                amt,
			Type:                  "transfer",
			ProviderSlug:          "shopeepay",
			DestinationWalletHint: "shopeepay",
			RefNumber:             ref,
			Note:                  "Top up ShopeePay",
			TransactionAt:         postedAt,
		}, nil
	}

	// Pembayaran ShopeePay
	merchant := extractMerchant(text)
	return ParsedNotification{
		Amount:        amt,
		Merchant:      merchant,
		Type:          "expense",
		ProviderSlug:  "shopeepay",
		RefNumber:     ref,
		Note:          "Pembayaran ShopeePay",
		TransactionAt: postedAt,
	}, nil
}

func parseBlu(text string, postedAt time.Time) (ParsedNotification, error) {
	amt, err := extractFirstRupiahAmount(text)
	if err != nil {
		return ParsedNotification{}, err
	}

	lower := strings.ToLower(text)
	ref := extractRefNumber(text)

	// Transfer blu
	if strings.Contains(lower, "transfer") {
		note := "Transfer blu"
		destHint := ""
		if reDest := regexp.MustCompile(`(?i)ke\s+([A-Za-z0-9\s]+?)(?:\s+berhasil|\s+pada|\.|$)`); reDest.MatchString(text) {
			m := reDest.FindStringSubmatch(text)
			if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
				dest := strings.TrimSpace(m[1])
				note = "Transfer ke " + dest
				if strings.Contains(strings.ToLower(dest), "bca") {
					destHint = "bca"
				}
			}
		}
		return ParsedNotification{
			Amount:                amt,
			Type:                  "transfer",
			ProviderSlug:          "blu",
			DestinationWalletHint: destHint,
			RefNumber:             ref,
			Note:                  note,
			TransactionAt:         postedAt,
		}, nil
	}

	// Pembayaran QRIS / bluDebit
	merchant := extractMerchant(text)
	note := "Transaksi blu"
	if strings.Contains(lower, "bludebit") {
		note = "bluDebit"
	} else if strings.Contains(lower, "qris") {
		note = "Pembayaran QRIS blu"
	}

	return ParsedNotification{
		Amount:        amt,
		Merchant:      merchant,
		Type:          "expense",
		ProviderSlug:  "blu",
		RefNumber:     ref,
		Note:          note,
		TransactionAt: postedAt,
	}, nil
}

func parseGeneric(text, slug string, postedAt time.Time) (ParsedNotification, error) {
	amt, err := extractFirstRupiahAmount(text)
	if err != nil {
		return ParsedNotification{}, err
	}

	lower := strings.ToLower(text)
	ref := extractRefNumber(text)
	merchant := extractMerchant(text)

	txType := "expense"
	destHint := ""
	if strings.Contains(lower, "transfer") || strings.Contains(lower, "top up") || strings.Contains(lower, "topup") || strings.Contains(lower, "isi saldo") {
		txType = "transfer"
		if slug != "" {
			destHint = slug
		}
	} else if strings.Contains(lower, "terima") || strings.Contains(lower, "masuk") || strings.Contains(lower, "menerima") {
		txType = "income"
	}

	return ParsedNotification{
		Amount:                amt,
		Merchant:              merchant,
		Type:                  txType,
		ProviderSlug:          slug,
		RefNumber:             ref,
		DestinationWalletHint: destHint,
		Note:                  "Notifikasi transaksi",
		TransactionAt:         postedAt,
	}, nil
}
