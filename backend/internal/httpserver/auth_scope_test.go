package httpserver

import (
	"net/http"
	"testing"
)

func TestAPIKeyAllows(t *testing.T) {
	read := []string{"transactions:read"}
	write := []string{"transactions:write"}
	cases := []struct {
		name   string
		method string
		path   string
		scopes []string
		want   bool
	}{
		{"read key can GET", http.MethodGet, "/transactions", read, true},
		{"read key cannot POST", http.MethodPost, "/transactions", read, false},
		{"write key can POST", http.MethodPost, "/transactions", write, true},
		{"write key can GET", http.MethodGet, "/wallets", write, true},
		{"legacy empty scopes keep access", http.MethodPost, "/transactions", nil, true},
		{"key cannot list api keys", http.MethodGet, "/api-keys", write, false},
		{"legacy key cannot mint tokens", http.MethodPost, "/webhook-tokens", nil, false},
		{"wildcard", http.MethodDelete, "/transactions/1", []string{"*"}, true},
	}
	for _, c := range cases {
		if got := apiKeyAllows(c.method, c.path, c.scopes); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestWebhookTokenAllows(t *testing.T) {
	if !webhookTokenAllows(http.MethodPost, "/ai/extract-transaction") {
		t.Error("extract-transaction must stay reachable")
	}
	for _, p := range []string{"/transactions", "/wallets", "/me", "/api-keys", "/webhook-tokens"} {
		if webhookTokenAllows(http.MethodGet, p) || webhookTokenAllows(http.MethodPost, p) {
			t.Errorf("webhook token must not reach %s", p)
		}
	}
}
