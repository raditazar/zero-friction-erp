package httpserver

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGmailMachineIdentityValidatesSignedClaims(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	http.DefaultTransport = gmailRoundTripper(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != "https://www.googleapis.com/oauth2/v3/certs" {
			t.Fatalf("unexpected cert request %s", r.URL.Path)
		}
		response := gmailJSON(map[string]any{"keys": []any{map[string]string{"kid": "gmail-test", "alg": "RS256", "kty": "RSA", "use": "sig", "n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes())}}}, 200)
		response.Header.Set("Cache-Control", "max-age=0")
		return response, nil
	})
	sign := func(claims map[string]any) string {
		b, _ := json.Marshal(claims)
		header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","kid":"gmail-test"}`))
		body := header + "." + base64.RawURLEncoding.EncodeToString(b)
		hash := sha256.Sum256([]byte(body))
		sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
		if err != nil {
			t.Fatal(err)
		}
		return body + "." + base64.RawURLEncoding.EncodeToString(sig)
	}
	audience := "https://example.invalid/integrations/gmail/push"
	account := "push@example.invalid"
	for _, test := range []struct {
		name, claim string
		value       any
		want        bool
	}{
		{"valid", "", nil, true},
		{"wrong_audience", "aud", "https://attacker.invalid", false},
		{"wrong_issuer", "iss", "https://attacker.invalid", false},
		{"wrong_account", "email", "attacker@example.invalid", false},
		{"unverified", "email_verified", false, false},
		{"expired", "exp", time.Now().Add(-time.Hour).Unix(), false},
	} {
		t.Run(test.name, func(t *testing.T) {
			claims := map[string]any{"iss": "https://accounts.google.com", "aud": audience, "exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "sub": "test-sa", "email": account, "email_verified": true}
			if test.claim != "" {
				claims[test.claim] = test.value
			}
			r := httptest.NewRequest("POST", audience, nil)
			r.Header.Set("Authorization", "Bearer "+sign(claims))
			if got := gmailMachineAuth(r, audience, account); got != test.want {
				t.Fatalf("authenticated=%v want=%v", got, test.want)
			}
		})
	}
}
