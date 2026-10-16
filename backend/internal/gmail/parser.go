package gmail

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"regexp"
	"strings"
	"time"
	_ "time/tzdata"

	"golang.org/x/net/html"
)

const Sender = "bifast.noreply@cimbniaga.co.id"
const Subject = "[CONFIDENTIAL] INCOMING BI FAST"
const Query = `from:bifast.noreply@cimbniaga.co.id subject:"INCOMING BI FAST"`
const maxEmail = 2 << 20

var ErrNotCIMB = errors.New("not_cimb_bifast")
var ErrUnauthenticated = errors.New("email_authentication_failed")

type Receipt struct {
	Type                  string    `json:"type"`                     // "income", "expense", "transfer"
	Amount                string    `json:"amount"`
	TransactionAt         time.Time `json:"transaction_at"`
	DateOnly              bool      `json:"date_only"`
	SenderName            string    `json:"sender_name"`
	SenderBank            string    `json:"sender_bank"`
	RecipientAccount      string    `json:"recipient_account,omitempty"`
	MerchantOrSender      string    `json:"merchant_or_sender,omitempty"`
	ProviderSlug          string    `json:"provider_slug,omitempty"` // "cimb", "gopay", "ovo", "shopeepay", "dana"
	DestinationWalletHint string    `json:"destination_wallet_hint,omitempty"`
	IsInternalTransfer    bool      `json:"is_internal_transfer"`
	Note                  string    `json:"note,omitempty"`
	Source                string    `json:"source,omitempty"`
}

// IsCandidate returns true if the email metadata indicates a candidate financial notification
func IsCandidate(from, subject string) bool {
	from = strings.ToLower(from)
	subject = strings.ToLower(subject)

	if strings.Contains(from, "cimbniaga.co.id") || MatchesSubject(subject) {
		return true
	}
	if strings.Contains(from, "gojek.com") || strings.Contains(from, "gopay.co.id") || strings.Contains(subject, "gopay") {
		return true
	}
	if strings.Contains(from, "ovo.id") || strings.Contains(subject, "ovo") {
		return true
	}
	if strings.Contains(from, "shopee.co.id") || strings.Contains(from, "shopeepay") || strings.Contains(subject, "shopeepay") {
		return true
	}
	if strings.Contains(from, "dana.id") || strings.Contains(subject, "dana") {
		return true
	}
	return false
}

// Parse reads an RFC822 message returned by Gmail format=raw. Caller must not
// use user-uploaded headers as proof of authenticity. Offline parsing is separate.
func Parse(raw []byte, authenticate bool) (Receipt, error) {
	if len(raw) > maxEmail {
		return Receipt{}, errors.New("email_too_large")
	}
	m, err := mail.ReadMessage(bytes.NewReader(raw))
	if err != nil {
		return Receipt{}, errors.New("invalid_email")
	}
	from, err := mail.ParseAddressList(m.Header.Get("From"))
	if err != nil || len(from) != 1 {
		return Receipt{}, ErrNotCIMB
	}
	fromAddr := strings.ToLower(from[0].Address)
	subject := m.Header.Get("Subject")

	if !IsCandidate(fromAddr, subject) {
		return Receipt{}, ErrNotCIMB
	}

	if authenticate && !trustedAuthentication(m.Header, fromAddr) {
		return Receipt{}, ErrUnauthenticated
	}
	text, err := mimeText(m.Header.Get("Content-Type"), m.Header.Get("Content-Transfer-Encoding"), m.Body, 0)
	if err != nil {
		return Receipt{}, err
	}

	// 1. CIMB Incoming BI FAST
	if strings.EqualFold(fromAddr, Sender) {
		if !MatchesSubject(subject) {
			return Receipt{}, ErrNotCIMB
		}
		return parseText(text)
	}

	// 2. Other CIMB (e.g. Debit, QRIS, Transfer Out)
	if strings.Contains(fromAddr, "cimbniaga.co.id") {
		if receipt, err := parseCIMBGeneric(text, subject); err == nil {
			return receipt, nil
		}
		return FallbackParse(context.Background(), text, fromAddr, subject)
	}

	// 3. GoPay / Gojek
	if strings.Contains(fromAddr, "gojek.com") || strings.Contains(fromAddr, "gopay.co.id") {
		if receipt, err := parseGoPay(text, subject); err == nil {
			return receipt, nil
		}
		return FallbackParse(context.Background(), text, fromAddr, subject)
	}

	// 4. OVO
	if strings.Contains(fromAddr, "ovo.id") {
		if receipt, err := parseOVO(text, subject); err == nil {
			return receipt, nil
		}
		return FallbackParse(context.Background(), text, fromAddr, subject)
	}

	// 5. ShopeePay
	if strings.Contains(fromAddr, "shopee.co.id") || strings.Contains(fromAddr, "shopeepay.co.id") {
		if receipt, err := parseShopeePay(text, subject); err == nil {
			return receipt, nil
		}
		return FallbackParse(context.Background(), text, fromAddr, subject)
	}

	// 6. DANA
	if strings.Contains(fromAddr, "dana.id") {
		if receipt, err := parseDANA(text, subject); err == nil {
			return receipt, nil
		}
		return FallbackParse(context.Background(), text, fromAddr, subject)
	}

	return Receipt{}, ErrNotCIMB
}

// CIMB's original receipt omits the space after the confidentiality marker.
// Accept that separator variation, without accepting other notification titles.
func MatchesSubject(value string) bool {
	decoded, err := new(mime.WordDecoder).DecodeHeader(value)
	return err == nil && regexp.MustCompile(`^\[CONFIDENTIAL\]\s*INCOMING BI FAST$`).MatchString(strings.TrimSpace(decoded))
}

// Require Google's topmost Authentication-Results, not a lower, sender-supplied
// header. DMARC must pass and align exactly with sender's domain. Fail closed.
func trustedAuthentication(h mail.Header, senderAddress ...string) bool {
	values := h["Authentication-Results"]
	if len(values) == 0 {
		return false
	}
	value := strings.ToLower(values[0])
	parts := strings.Split(value, ";")
	if strings.TrimSpace(parts[0]) != "mx.google.com" {
		return false
	}

	domain := "cimbniaga.co.id"
	if len(senderAddress) > 0 && senderAddress[0] != "" {
		addr := senderAddress[0]
		if at := strings.LastIndex(addr, "@"); at != -1 {
			domain = strings.ToLower(strings.TrimSpace(addr[at+1:]))
		}
	}

	reDmarc := regexp.MustCompile(`^\s*dmarc=pass(?:\s|\()`)
	reDomain := regexp.MustCompile(fmt.Sprintf(`\bheader\.from=%s(?:\s|;|$)`, regexp.QuoteMeta(domain)))

	for _, part := range parts[1:] {
		if reDmarc.MatchString(part) && reDomain.MatchString(part) {
			return true
		}
	}
	return false
}

func mimeText(contentType, encoding string, r io.Reader, depth int) (string, error) {
	if depth > 8 {
		return "", errors.New("mime_depth_exceeded")
	}
	if contentType == "" {
		contentType = "text/plain"
	}
	kind, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", errors.New("invalid_mime")
	}
	if strings.HasPrefix(kind, "multipart/") {
		reader := multipart.NewReader(r, params["boundary"])
		var texts []string
		for {
			part, err := reader.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				return "", errors.New("invalid_mime")
			}
			if part.FileName() != "" {
				_ = part.Close()
				continue
			}
			t, err := mimeText(part.Header.Get("Content-Type"), part.Header.Get("Content-Transfer-Encoding"), part, depth+1)
			_ = part.Close()
			if err != nil {
				return "", err
			}
			if t != "" {
				texts = append(texts, t)
			}
		}
		// Prefer the first readable alternative; concatenating alternatives creates
		// duplicate fields and can turn a valid receipt into an ambiguous one.
		if len(texts) > 0 {
			return texts[0], nil
		}
		return "", errors.New("missing_email_text")
	}
	if kind != "text/plain" && kind != "text/html" {
		return "", nil
	}
	charset := strings.ToLower(params["charset"])
	if charset != "" && charset != "utf-8" && charset != "us-ascii" {
		return "", errors.New("unsupported_charset")
	}
	switch strings.ToLower(encoding) {
	case "base64":
		r = base64.NewDecoder(base64.StdEncoding, r)
	case "quoted-printable":
		r = quotedprintable.NewReader(r)
	case "", "7bit", "8bit", "binary":
	default:
		return "", errors.New("unsupported_encoding")
	}
	b, err := io.ReadAll(io.LimitReader(r, maxEmail+1))
	if err != nil || len(b) > maxEmail {
		return "", errors.New("invalid_email_body")
	}
	if kind == "text/plain" {
		return string(b), nil
	}
	z := html.NewTokenizer(bytes.NewReader(b))
	var out strings.Builder
	hidden := 0
	for {
		switch z.Next() {
		case html.ErrorToken:
			if z.Err() != io.EOF {
				return "", errors.New("invalid_html")
			}
			return out.String(), nil
		case html.StartTagToken, html.SelfClosingTagToken:
			name, _ := z.TagName()
			tag := string(name)
			if tag == "script" || tag == "style" {
				hidden++
			}
			if tag == "br" || tag == "tr" || tag == "p" || tag == "div" {
				out.WriteByte('\n')
			}
		case html.EndTagToken:
			name, _ := z.TagName()
			tag := string(name)
			if (tag == "script" || tag == "style") && hidden > 0 {
				hidden--
			}
			if tag == "td" || tag == "th" {
				out.WriteByte(' ')
			}
			if tag == "tr" || tag == "p" || tag == "div" {
				out.WriteByte('\n')
			}
		case html.TextToken:
			if hidden == 0 {
				out.Write(z.Text())
			}
		}
	}
}

var fieldPattern = regexp.MustCompile(`(?i)^(tanggal transaksi|nama penerima|(?:no\.?|nomor) rekening penerima|nominal|nama pengirim|bank pengirim)\s*:?\s*(.*)$`)

func parseText(text string) (Receipt, error) {
	fields := map[string]string{}
	lines := strings.Split(strings.ReplaceAll(text, "\r", ""), "\n")
	for i := 0; i < len(lines); i++ {
		line := strings.Join(strings.Fields(lines[i]), " ")
		m := fieldPattern.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		key, value := strings.ToLower(m[1]), strings.TrimSpace(m[2])
		if strings.Contains(key, "rekening") {
			key = "rekening"
		}
		if value == "" {
			for i+1 < len(lines) && strings.TrimSpace(lines[i+1]) == "" {
				i++
			}
			if i+1 < len(lines) {
				i++
				value = strings.TrimSpace(lines[i])
			}
		}
		value = strings.TrimSpace(strings.TrimPrefix(value, ":"))
		if _, exists := fields[key]; exists {
			return Receipt{}, errors.New("ambiguous_fields")
		}
		fields[key] = value
	}
	for _, key := range []string{"tanggal transaksi", "rekening", "nominal", "nama pengirim", "bank pengirim"} {
		if fields[key] == "" {
			return Receipt{}, fmt.Errorf("missing_%s", strings.ReplaceAll(key, " ", "_"))
		}
	}
	amount, err := parseAmount(fields["nominal"])
	if err != nil {
		return Receipt{}, err
	}
	date, dateOnly, err := parseDate(fields["tanggal transaksi"])
	if err != nil {
		return Receipt{}, err
	}
	account := strings.ReplaceAll(fields["rekening"], " ", "")
	if !regexp.MustCompile(`^[0-9]{6,30}$`).MatchString(account) {
		return Receipt{}, errors.New("invalid_recipient_account")
	}
	if len(fields["nama pengirim"]) > 200 || len(fields["bank pengirim"]) > 200 {
		return Receipt{}, errors.New("invalid_sender")
	}
	return Receipt{
		Type:             "income",
		Amount:           amount,
		TransactionAt:    date,
		DateOnly:         dateOnly,
		SenderName:       fields["nama pengirim"],
		SenderBank:       fields["bank pengirim"],
		RecipientAccount: account,
		MerchantOrSender: fields["nama pengirim"],
		ProviderSlug:     "cimb",
		Note:             "CIMB Incoming BI FAST — " + fields["bank pengirim"],
		Source:           "cimb_bifast_parser",
	}, nil
}

func parseAmount(value string) (string, error) {
	value = strings.TrimSpace(value)
	value = regexp.MustCompile(`(?i)^(rp\.?|idr)\s*`).ReplaceAllString(value, "")
	// Indonesian number grouping only. Never guess whether 1,000 means 1 or 1000.
	if !regexp.MustCompile(`^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+)(?:,[0-9]{2})?$`).MatchString(value) {
		return "", errors.New("invalid_amount")
	}
	value = strings.ReplaceAll(value, ".", "")
	parts := strings.Split(value, ",")
	whole := strings.TrimLeft(parts[0], "0")
	if whole == "" {
		whole = "0"
	}
	fraction := "00"
	if len(parts) == 2 {
		fraction = parts[1]
	}
	if len(whole) > 16 || (whole == "0" && fraction == "00") {
		return "", errors.New("invalid_amount")
	}
	return whole + "." + fraction, nil
}

func parseDate(value string) (time.Time, bool, error) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	for _, layout := range []string{"02/01/2006 15:04:05", "02-01-2006 15:04:05", "2006-01-02 15:04:05", "02/01/2006 15:04", "02-01-2006 15:04", "02/01/2006", "02-01-2006", "2006-01-02"} {
		if t, err := time.ParseInLocation(layout, value, loc); err == nil {
			return t, !strings.Contains(layout, "15:"), nil
		}
	}
	return time.Time{}, false, errors.New("invalid_transaction_date")
}

func extractAmount(text string) (string, error) {
	labeledRe := regexp.MustCompile(`(?i)(?:total(?:\s+pembayaran|\s+bayar|\s+transaksi|\s+belanja)?|nominal|jumlah(?:\s+top\s*up)?|sebesar)\s*:?\s*(?:rp\.?|idr)?\s*([0-9\.,]+)`)
	matches := labeledRe.FindStringSubmatch(text)
	if len(matches) > 1 {
		if amt, err := parseAmount(matches[1]); err == nil {
			return amt, nil
		}
	}
	currRe := regexp.MustCompile(`(?i)(?:rp\.?|idr)\s*([0-9\.,]+)`)
	allMatches := currRe.FindAllStringSubmatch(text, -1)
	for _, m := range allMatches {
		if len(m) > 1 {
			if amt, err := parseAmount(m[1]); err == nil {
				return amt, nil
			}
		}
	}
	return "", errors.New("amount_not_found")
}

func extractDate(text string) (time.Time, bool) {
	dateRe := regexp.MustCompile(`([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}(?:\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?)`)
	matches := dateRe.FindAllString(text, -1)
	for _, m := range matches {
		if t, dateOnly, err := parseDate(m); err == nil {
			return t, dateOnly
		}
	}
	return time.Now(), false
}

func parseCIMBGeneric(text, subject string) (Receipt, error) {
	lowerSubj := strings.ToLower(subject)
	lowerText := strings.ToLower(text)

	amt, err := extractAmount(text)
	if err != nil {
		return Receipt{}, err
	}
	t, dateOnly := extractDate(text)

	isTopUp := strings.Contains(lowerSubj, "top up") || strings.Contains(lowerSubj, "isi saldo") || strings.Contains(lowerText, "top up")
	txType := "expense"
	destHint := ""
	if isTopUp {
		txType = "transfer"
		if strings.Contains(lowerText, "gopay") {
			destHint = "gopay"
		} else if strings.Contains(lowerText, "ovo") {
			destHint = "ovo"
		} else if strings.Contains(lowerText, "shopee") {
			destHint = "shopeepay"
		} else if strings.Contains(lowerText, "dana") {
			destHint = "dana"
		}
	}

	merchant := "CIMB Niaga Transaction"
	if re := regexp.MustCompile(`(?i)(?:merchant|tujuan|penerima)\s*:?\s*([^\n\r]+)`); re.MatchString(text) {
		m := re.FindStringSubmatch(text)
		if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
			merchant = strings.TrimSpace(m[1])
		}
	} else if subject != "" {
		merchant = subject
	}

	return Receipt{
		Type:                  txType,
		Amount:                amt,
		TransactionAt:         t,
		DateOnly:              dateOnly,
		MerchantOrSender:      merchant,
		ProviderSlug:          "cimb",
		DestinationWalletHint: destHint,
		IsInternalTransfer:    isTopUp,
		Note:                  "CIMB Email — " + merchant,
		Source:                "cimb_generic_parser",
	}, nil
}

func parseGoPay(text, subject string) (Receipt, error) {
	lowerSubj := strings.ToLower(subject)
	lowerText := strings.ToLower(text)

	amt, err := extractAmount(text)
	if err != nil {
		return Receipt{}, err
	}
	t, dateOnly := extractDate(text)

	isTopUp := strings.Contains(lowerSubj, "top up") || strings.Contains(lowerSubj, "isi saldo") || strings.Contains(lowerText, "top up") || strings.Contains(lowerText, "isi saldo berhasil")
	txType := "expense"
	destHint := ""
	if isTopUp {
		txType = "transfer"
		destHint = "gopay"
	}

	merchant := "GoPay / Gojek"
	if isTopUp {
		merchant = "Top Up GoPay"
	} else if re := regexp.MustCompile(`(?i)(?:restoran|merchant|toko|tujuan)\s*:?\s*([^\n\r]+)`); re.MatchString(text) {
		m := re.FindStringSubmatch(text)
		if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
			merchant = strings.TrimSpace(m[1])
		}
	} else if strings.Contains(lowerSubj, "pesanan gofood") || strings.Contains(lowerSubj, "gofood") {
		merchant = "GoFood Order"
	}

	return Receipt{
		Type:                  txType,
		Amount:                amt,
		TransactionAt:         t,
		DateOnly:              dateOnly,
		MerchantOrSender:      merchant,
		ProviderSlug:          "gopay",
		DestinationWalletHint: destHint,
		IsInternalTransfer:    isTopUp,
		Note:                  "GoPay Transaction — " + merchant,
		Source:                "gopay_parser",
	}, nil
}

func parseOVO(text, subject string) (Receipt, error) {
	lowerSubj := strings.ToLower(subject)
	lowerText := strings.ToLower(text)

	amt, err := extractAmount(text)
	if err != nil {
		return Receipt{}, err
	}
	t, dateOnly := extractDate(text)

	isTopUp := strings.Contains(lowerSubj, "top up") || strings.Contains(lowerSubj, "isi saldo") || strings.Contains(lowerText, "top up berhasil")
	txType := "expense"
	destHint := ""
	if isTopUp {
		txType = "transfer"
		destHint = "ovo"
	}

	merchant := "OVO Payment"
	if isTopUp {
		merchant = "Top Up OVO"
	} else if re := regexp.MustCompile(`(?i)(?:merchant|toko|penerima)\s*:?\s*([^\n\r]+)`); re.MatchString(text) {
		m := re.FindStringSubmatch(text)
		if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
			merchant = strings.TrimSpace(m[1])
		}
	}

	return Receipt{
		Type:                  txType,
		Amount:                amt,
		TransactionAt:         t,
		DateOnly:              dateOnly,
		MerchantOrSender:      merchant,
		ProviderSlug:          "ovo",
		DestinationWalletHint: destHint,
		IsInternalTransfer:    isTopUp,
		Note:                  "OVO Transaction — " + merchant,
		Source:                "ovo_parser",
	}, nil
}

func parseShopeePay(text, subject string) (Receipt, error) {
	lowerSubj := strings.ToLower(subject)
	lowerText := strings.ToLower(text)

	amt, err := extractAmount(text)
	if err != nil {
		return Receipt{}, err
	}
	t, dateOnly := extractDate(text)

	isTopUp := strings.Contains(lowerSubj, "top up") || strings.Contains(lowerSubj, "isi saldo") || strings.Contains(lowerText, "isi saldo berhasil")
	txType := "expense"
	destHint := ""
	if isTopUp {
		txType = "transfer"
		destHint = "shopeepay"
	}

	merchant := "ShopeePay Payment"
	if isTopUp {
		merchant = "Top Up ShopeePay"
	} else if re := regexp.MustCompile(`(?i)(?:merchant|toko|pesanan)\s*:?\s*([^\n\r]+)`); re.MatchString(text) {
		m := re.FindStringSubmatch(text)
		if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
			merchant = strings.TrimSpace(m[1])
		}
	}

	return Receipt{
		Type:                  txType,
		Amount:                amt,
		TransactionAt:         t,
		DateOnly:              dateOnly,
		MerchantOrSender:      merchant,
		ProviderSlug:          "shopeepay",
		DestinationWalletHint: destHint,
		IsInternalTransfer:    isTopUp,
		Note:                  "ShopeePay Transaction — " + merchant,
		Source:                "shopeepay_parser",
	}, nil
}

func parseDANA(text, subject string) (Receipt, error) {
	lowerSubj := strings.ToLower(subject)
	lowerText := strings.ToLower(text)

	amt, err := extractAmount(text)
	if err != nil {
		return Receipt{}, err
	}
	t, dateOnly := extractDate(text)

	isTopUp := strings.Contains(lowerSubj, "top up") || strings.Contains(lowerSubj, "isi saldo") || strings.Contains(lowerText, "isi saldo berhasil")
	txType := "expense"
	destHint := ""
	if isTopUp {
		txType = "transfer"
		destHint = "dana"
	}

	merchant := "DANA Payment"
	if isTopUp {
		merchant = "Top Up DANA"
	} else if re := regexp.MustCompile(`(?i)(?:merchant|toko|penerima)\s*:?\s*([^\n\r]+)`); re.MatchString(text) {
		m := re.FindStringSubmatch(text)
		if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
			merchant = strings.TrimSpace(m[1])
		}
	}

	return Receipt{
		Type:                  txType,
		Amount:                amt,
		TransactionAt:         t,
		DateOnly:              dateOnly,
		MerchantOrSender:      merchant,
		ProviderSlug:          "dana",
		DestinationWalletHint: destHint,
		IsInternalTransfer:    isTopUp,
		Note:                  "DANA Transaction — " + merchant,
		Source:                "dana_parser",
	}, nil
}
