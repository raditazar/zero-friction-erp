package android_test

import (
	"testing"
	"zero-friction-erp/backend/internal/android"
)

func TestParseGoPayPayment(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "GoPay",
		PackageName: "com.gojek.app",
		Title:       "Pembayaran Berhasil",
		Text:        "Kamu berhasil bayar Rp35.000 ke Kopi Kenangan",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Amount != 35000 || res.Merchant != "Kopi Kenangan" || res.Type != "expense" || res.ProviderSlug != "gopay" {
		t.Fatalf("unexpected result: %+v", res)
	}

	payload2 := android.NotificationPayload{
		AppName:     "GoPay",
		PackageName: "com.gojek.gopay",
		Title:       "Pembayaran Berhasil",
		Text:        "Pembayaran Rp35.000 ke Kopi Kenangan berhasil",
	}
	res2, err := android.Parse(payload2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res2.Amount != 35000 || res2.Merchant != "Kopi Kenangan" || res2.Type != "expense" {
		t.Fatalf("unexpected result: %+v", res2)
	}

	payload3 := android.NotificationPayload{
		AppName:     "GoPay",
		PackageName: "com.gojek.app",
		Title:       "Bayar Berhasil",
		Text:        "Kamu berhasil bayar Rp 50.000 ke Solaria",
	}
	res3, err := android.Parse(payload3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res3.Amount != 50000 || res3.Merchant != "Solaria" || res3.Type != "expense" {
		t.Fatalf("unexpected result: %+v", res3)
	}
}

func TestParseGoPayTopUpTransfer(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "GoPay",
		PackageName: "com.gojek.app",
		Title:       "Top Up Berhasil",
		Text:        "Top up GoPay Rp100.000 dari BCA berhasil",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Amount != 100000 || res.Type != "transfer" || res.ProviderSlug != "gopay" || res.DestinationWalletHint != "gopay" {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestParseCIMBOCTOTransfer(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "OCTO Mobile",
		PackageName: "com.cimb.octo",
		Title:       "Transfer Berhasil",
		Text:        "Transfer berhasil ke 1234567890 Rp500.000 Ref: CIMB-998877",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Amount != 500000 || res.Type != "transfer" || res.RefNumber != "CIMB-998877" || res.ProviderSlug != "cimb" {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestParseCIMBOCTOPurchaseAndQRIS(t *testing.T) {
	payload1 := android.NotificationPayload{
		AppName:     "OCTO Mobile",
		PackageName: "com.cimbniaga.octo",
		Title:       "Transaksi Berhasil",
		Text:        "Pembelian Rp45.000 di Alfamart berhasil",
	}
	res1, err := android.Parse(payload1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res1.Amount != 45000 || res1.Merchant != "Alfamart" || res1.Type != "expense" || res1.ProviderSlug != "cimb" {
		t.Fatalf("unexpected result: %+v", res1)
	}

	payload2 := android.NotificationPayload{
		AppName:     "OCTO Mobile",
		PackageName: "com.cimb.octo",
		Title:       "Pembayaran QRIS",
		Text:        "Pembayaran QRIS Rp 75.000 ke Resto Padang berhasil",
	}
	res2, err := android.Parse(payload2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res2.Amount != 75000 || res2.Merchant != "Resto Padang" || res2.Type != "expense" || res2.ProviderSlug != "cimb" {
		t.Fatalf("unexpected result: %+v", res2)
	}
}

func TestParseShopeePay(t *testing.T) {
	// Payment
	payloadPayment := android.NotificationPayload{
		AppName:     "ShopeePay",
		PackageName: "com.shopeepay",
		Title:       "Pembayaran Berhasil",
		Text:        "Pembayaran ShopeePay Rp25.000 ke Indomaret berhasil",
	}
	res, err := android.Parse(payloadPayment)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Amount != 25000 || res.Merchant != "Indomaret" || res.Type != "expense" || res.ProviderSlug != "shopeepay" {
		t.Fatalf("unexpected result: %+v", res)
	}

	// Top Up
	payloadTopup := android.NotificationPayload{
		AppName:     "Shopee",
		PackageName: "id.co.shopee",
		Title:       "Top Up Berhasil",
		Text:        "Top up ShopeePay Rp 200.000 berhasil",
	}
	resTopup, err := android.Parse(payloadTopup)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resTopup.Amount != 200000 || resTopup.Type != "transfer" || resTopup.ProviderSlug != "shopeepay" || resTopup.DestinationWalletHint != "shopeepay" {
		t.Fatalf("unexpected result: %+v", resTopup)
	}
}

func TestParseBlu(t *testing.T) {
	// QRIS Payment
	payloadQRIS := android.NotificationPayload{
		AppName:     "blu by BCA",
		PackageName: "com.blu.app",
		Title:       "Transaksi Berhasil",
		Text:        "Pembayaran QRIS Rp25.500 di Alfamart berhasil",
	}
	resQRIS, err := android.Parse(payloadQRIS)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resQRIS.Amount != 25500 || resQRIS.Merchant != "Alfamart" || resQRIS.Type != "expense" || resQRIS.ProviderSlug != "blu" {
		t.Fatalf("unexpected result: %+v", resQRIS)
	}

	// Transfer
	payloadTransfer := android.NotificationPayload{
		AppName:     "blu",
		PackageName: "id.co.bca.blu",
		Title:       "Transfer Berhasil",
		Text:        "Transfer Rp200.000 ke BCA 1234567 berhasil",
	}
	resTransfer, err := android.Parse(payloadTransfer)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resTransfer.Amount != 200000 || resTransfer.Type != "transfer" || resTransfer.ProviderSlug != "blu" {
		t.Fatalf("unexpected result: %+v", resTransfer)
	}

	// bluDebit
	payloadDebit := android.NotificationPayload{
		AppName:     "blu by BCA",
		PackageName: "com.blu.app",
		Title:       "Transaksi Kartu",
		Text:        "bluDebit berhasil Rp 150.000 di Tokopedia",
	}
	resDebit, err := android.Parse(payloadDebit)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resDebit.Amount != 150000 || resDebit.Merchant != "Tokopedia" || resDebit.Type != "expense" || resDebit.ProviderSlug != "blu" {
		t.Fatalf("unexpected result: %+v", resDebit)
	}
}

func TestFilterPromoNotification(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "GoPay",
		PackageName: "com.gojek.app",
		Title:       "Diskon 50% Buat Kamu!",
		Text:        "Gunakan kode promo HEMAT50 untuk pesanan makananmu hari ini",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.IsFiltered || res.FilterReason != "promo_or_security_filter" {
		t.Fatalf("expected notification to be filtered, got: %+v", res)
	}
}

func TestFilterOTPNotification(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "OCTO Mobile",
		PackageName: "com.cimb.octo",
		Title:       "Kode Keamanan",
		Text:        "Kode OTP Anda adalah 883921. Jangan berikan kode ini kepada siapapun.",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.IsFiltered || res.FilterReason != "promo_or_security_filter" {
		t.Fatalf("expected OTP to be filtered, got: %+v", res)
	}
}

func TestFilterBalanceInfoNotification(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "GoPay",
		PackageName: "com.gojek.app",
		Title:       "Informasi Saldo",
		Text:        "Saldo GoPay Anda saat ini adalah Rp 125.000",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.IsFiltered || res.FilterReason != "promo_or_security_filter" {
		t.Fatalf("expected balance info to be filtered, got: %+v", res)
	}
}

func TestGenericFallbackParser(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "DompetDigital",
		PackageName: "com.unknown.wallet",
		Title:       "Pembayaran Berhasil",
		Text:        "Transaksi sebesar Rp85.000 di Warung Kopi berhasil Ref: TRX-112233",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Amount != 85000 || res.Merchant != "Warung Kopi" || res.RefNumber != "TRX-112233" || res.Type != "expense" {
		t.Fatalf("unexpected result: %+v", res)
	}
}

func TestDateAndDecimalParsing(t *testing.T) {
	payload := android.NotificationPayload{
		AppName:     "GoPay",
		PackageName: "com.gojek.app",
		Title:       "Pembayaran Berhasil",
		Text:        "Kamu berhasil bayar Rp 150.000,00 ke Supermarket",
		PostedAt:    "2026-10-23T14:30:00Z",
	}
	res, err := android.Parse(payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Amount != 150000 || res.Merchant != "Supermarket" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if res.TransactionAt.Format("2006-01-02T15:04:05Z07:00") != "2026-10-23T14:30:00Z" {
		t.Fatalf("unexpected transaction date: %v", res.TransactionAt)
	}
}

