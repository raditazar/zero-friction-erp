package gmail

import (
	"encoding/base64"
	"errors"
	"os"
	"strings"
	"testing"
)

func fixture(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("testdata/cimb-synthetic.eml")
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}
func TestCIMBReceipt(t *testing.T) {
	raw := fixture(t)
	r, err := Parse([]byte(raw), true)
	if err != nil || r.Amount != "25000.00" || r.SenderName != "PENGIRIM DEMO" || r.SenderBank != "BANK DEMO" || r.RecipientAccount != "1234567890" || r.TransactionAt.Format("2006-01-02T15:04:05Z07:00") != "2026-10-06T13:45:20+07:00" {
		t.Fatalf("unexpected receipt: %#v %v", r, err)
	}
	tests := []struct {
		name, old, new string
		want           error
	}{
		{"forged_sender", "BIFAST.NOREPLY@cimbniaga.co.id", "attacker@example.invalid", ErrNotCIMB},
		{"wrong_subject", Subject, "PROMO", ErrNotCIMB},
		{"failed_auth", "dmarc=pass", "dmarc=fail", ErrUnauthenticated},
		{"wrong_alignment", "header.from=cimbniaga.co.id", "header.from=attacker.invalid", ErrUnauthenticated},
		{"forged_authserv", "mx.google.com", "attacker.invalid", ErrUnauthenticated},
		{"bad_amount", "25.000,00", "25,000.00", nil},
		{"zero_amount", "25.000,00", "0,00", nil},
		{"bad_date", "06/10/2026 13:45:20", "31/02/2026", nil},
		{"missing_sender", "Nama Pengirim: PENGIRIM DEMO", "", nil},
		{"masked_account", "1234567890", "1234****90", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Parse([]byte(strings.ReplaceAll(raw, tt.old, tt.new)), true)
			if err == nil || (tt.want != nil && !errors.Is(err, tt.want)) {
				t.Fatalf("expected rejection %v, got %v", tt.want, err)
			}
		})
	}
	r, err = Parse([]byte(strings.ReplaceAll(raw, "06/10/2026 13:45:20", "06/10/2026")), true)
	if err != nil || !r.DateOnly || r.TransactionAt.Hour() != 0 {
		t.Fatalf("date-only: %#v %v", r, err)
	}
	if _, err := Parse([]byte(strings.ReplaceAll(raw, Subject, "[CONFIDENTIAL]INCOMING BI FAST")), true); err != nil {
		t.Fatal("actual CIMB subject rejected", err)
	}
	if MatchesSubject("[CONFIDENTIAL]INCOMING BI FAST PROMO") {
		t.Fatal("unrelated subject accepted")
	}
	for _, value := range []string{"Rp 0,01", "IDR 1.234.567,89", "25000"} {
		if _, err := parseAmount(value); err != nil {
			t.Fatal(value, err)
		}
	}
	for _, value := range []string{"-1", "NaN", "1e4", "99999999999999999,00", "1.23", "1,2"} {
		if _, err := parseAmount(value); err == nil {
			t.Fatal("accepted", value)
		}
	}
}
func TestMIMEAlternatives(t *testing.T) {
	raw := fixture(t)
	header, body, _ := strings.Cut(raw, "\n\n")
	header = strings.Replace(header, "Content-Type: text/plain; charset=utf-8", `Content-Type: multipart/alternative; boundary="demo"`, 1)
	eml := header + "\n\n--demo\nContent-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: base64\n\n" + base64.StdEncoding.EncodeToString([]byte(body)) + "\n--demo\nContent-Type: text/html; charset=utf-8\n\n<p>Ignored duplicate alternative</p>\n--demo--\n"
	if r, err := Parse([]byte(eml), true); err != nil || r.Amount != "25000.00" {
		t.Fatal(r, err)
	}
	htmlBody := "<script>Nominal: Rp 99.000,00</script><style>ignored</style>"
	for _, line := range strings.Split(body, "\n") {
		htmlBody += "<tr><td>" + strings.Replace(line, ": ", "</td><td>", 1) + "</td></tr>"
	}
	header = strings.Replace(header, `Content-Type: multipart/alternative; boundary="demo"`, "Content-Type: text/html; charset=utf-8", 1)
	if r, err := Parse([]byte(header+"\n\n<table>"+htmlBody+"</table>"), true); err != nil || r.Amount != "25000.00" {
		t.Fatal(r, err)
	}
	// A forged lower header must not rescue a failed topmost result.
	forged := strings.Replace(raw, "Authentication-Results: mx.google.com;", "Authentication-Results: mx.google.com; dmarc=fail header.from=cimbniaga.co.id\nAuthentication-Results: mx.google.com;", 1)
	if _, err := Parse([]byte(forged), true); !errors.Is(err, ErrUnauthenticated) {
		t.Fatal(err)
	}
}
func TestEncryptedCredentials(t *testing.T) {
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	a, err := Seal(key, "secret", "owner:token")
	if err != nil {
		t.Fatal(err)
	}
	b, err := Seal(key, "secret", "owner:token")
	if err != nil || a == b {
		t.Fatal("nonce reuse", err)
	}
	plain, err := Open(key, a, "owner:token")
	if err != nil || plain != "secret" {
		t.Fatal(err)
	}
	if _, err := Open(key, a, "other-owner:token"); err == nil {
		t.Fatal("owner mismatch accepted")
	}
	if _, err := Open(key, a, "owner:account"); err == nil {
		t.Fatal("purpose mismatch accepted")
	}
	if _, err := Seal("bad-key", "secret", "owner"); err == nil {
		t.Fatal("bad key accepted")
	}
}

func TestGoPayReceipt(t *testing.T) {
	// Top Up Email
	topupEML := "Authentication-Results: mx.google.com; dmarc=pass header.from=gojek.com\n" +
		"From: no-reply@gojek.com\n" +
		"Subject: Top Up Saldo GoPay Berhasil\n" +
		"Content-Type: text/plain; charset=utf-8\n\n" +
		"Isi Saldo Berhasil!\n" +
		"Total Pembayaran: Rp 100.000\n" +
		"Tanggal: 14/10/2026 10:30:00\n"

	r, err := Parse([]byte(topupEML), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Type != "transfer" || !r.IsInternalTransfer || r.DestinationWalletHint != "gopay" || r.Amount != "100000.00" {
		t.Fatalf("unexpected topup receipt: %#v", r)
	}

	// Expense Email (GoFood Order)
	orderEML := "Authentication-Results: mx.google.com; dmarc=pass header.from=gojek.com\n" +
		"From: no-reply@gojek.com\n" +
		"Subject: Pesanan GoFood Selesai\n" +
		"Content-Type: text/plain; charset=utf-8\n\n" +
		"Terima kasih atas pesananmu!\n" +
		"Restoran: Kopi Kenangan Mall\n" +
		"Total Bayar: Rp 45.000\n" +
		"Tanggal: 14/10/2026 12:15:00\n"

	r2, err := Parse([]byte(orderEML), true)
	if err != nil {
		t.Fatalf("unexpected order error: %v", err)
	}
	if r2.Type != "expense" || r2.IsInternalTransfer || r2.Amount != "45000.00" || r2.ProviderSlug != "gopay" {
		t.Fatalf("unexpected order receipt: %#v", r2)
	}
}

func TestOVOReceipt(t *testing.T) {
	eml := "Authentication-Results: mx.google.com; dmarc=pass header.from=ovo.id\n" +
		"From: notif@ovo.id\n" +
		"Subject: Top Up Saldo OVO Berhasil\n" +
		"Content-Type: text/plain; charset=utf-8\n\n" +
		"Pengisian Saldo Berhasil\n" +
		"Nominal: Rp 50.000\n" +
		"Tanggal: 14/10/2026 09:00:00\n"

	r, err := Parse([]byte(eml), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Type != "transfer" || r.DestinationWalletHint != "ovo" || r.Amount != "50000.00" {
		t.Fatalf("unexpected OVO receipt: %#v", r)
	}
}

func TestShopeePayReceipt(t *testing.T) {
	eml := "Authentication-Results: mx.google.com; dmarc=pass header.from=shopeepay.co.id\n" +
		"From: info@shopeepay.co.id\n" +
		"Subject: Rincian Pembayaran ShopeePay\n" +
		"Content-Type: text/plain; charset=utf-8\n\n" +
		"Pembayaran Berhasil\n" +
		"Merchant: Alfamart Sudirman\n" +
		"Total Pembayaran: Rp 28.500\n" +
		"Tanggal: 14/10/2026 14:00:00\n"

	r, err := Parse([]byte(eml), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Type != "expense" || r.ProviderSlug != "shopeepay" || r.Amount != "28500.00" {
		t.Fatalf("unexpected ShopeePay receipt: %#v", r)
	}
}

func TestDANAReceipt(t *testing.T) {
	eml := "Authentication-Results: mx.google.com; dmarc=pass header.from=dana.id\n" +
		"From: no-reply@dana.id\n" +
		"Subject: Pembayaran DANA Berhasil\n" +
		"Content-Type: text/plain; charset=utf-8\n\n" +
		"Transaksi Berhasil\n" +
		"Toko: Indomaret Point\n" +
		"Total: Rp 15.000\n" +
		"Tanggal: 14/10/2026 15:30:00\n"

	r, err := Parse([]byte(eml), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Type != "expense" || r.ProviderSlug != "dana" || r.Amount != "15000.00" {
		t.Fatalf("unexpected DANA receipt: %#v", r)
	}
}

func TestCIMBDebitReceipt(t *testing.T) {
	eml := "Authentication-Results: mx.google.com; dmarc=pass header.from=cimbniaga.co.id\n" +
		"From: 14041@cimbniaga.co.id\n" +
		"Subject: [CONFIDENTIAL] TRANSAKSI DEBIT KARTU\n" +
		"Content-Type: text/plain; charset=utf-8\n\n" +
		"Transaksi Debit Berhasil\n" +
		"Merchant: Starbucks Grand Indonesia\n" +
		"Nominal: Rp 65.000\n" +
		"Tanggal: 14/10/2026 16:00:00\n"

	r, err := Parse([]byte(eml), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Type != "expense" || r.ProviderSlug != "cimb" || r.Amount != "65000.00" {
		t.Fatalf("unexpected CIMB debit receipt: %#v", r)
	}
}
