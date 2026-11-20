package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestQueryTokenAllowedOnlyOnCaptureRoute(t *testing.T) {
	cases := []struct {
		method, path string
		want         bool
	}{
		{http.MethodPost, "/ai/extract-transaction", true},
		{http.MethodGet, "/ai/extract-transaction", false},
		{http.MethodGet, "/transactions", false},
		{http.MethodPost, "/transactions", false},
		{http.MethodGet, "/me", false},
	}
	for _, tc := range cases {
		r := httptest.NewRequest(tc.method, tc.path+"?token=zfe_api_x", nil)
		if got := queryTokenAllowed(r); got != tc.want {
			t.Errorf("%s %s: got %v, want %v", tc.method, tc.path, got, tc.want)
		}
	}
}

func TestQueryTokenIgnoredOutsideCaptureRoute(t *testing.T) {
	s := &Server{}
	called := false
	h := s.withUserAuth(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/transactions?token=zfe_api_leaked", nil))
	if called || rec.Code != http.StatusUnauthorized {
		t.Fatalf("query token must not authenticate /transactions: called=%v code=%d", called, rec.Code)
	}
}

func TestIsLoopbackRequest(t *testing.T) {
	cases := map[string]bool{
		"127.0.0.1:5000":    true,
		"[::1]:5000":        true,
		"192.168.1.20:5000": false,
		"10.0.0.5:80":       false,
		"garbage":           false,
	}
	for addr, want := range cases {
		r := httptest.NewRequest(http.MethodGet, "/me", nil)
		r.RemoteAddr = addr
		if got := isLoopbackRequest(r); got != want {
			t.Errorf("%s: got %v, want %v", addr, got, want)
		}
	}
}
