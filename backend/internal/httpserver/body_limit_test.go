package httpserver

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeBodyRejectsOversizedBody(t *testing.T) {
	body := `{"note":"` + strings.Repeat("a", maxJSONBodyBytes) + `"}`
	r := httptest.NewRequest(http.MethodPost, "/transactions", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	var target map[string]any
	if decodeBody(rec, r, &target) {
		t.Fatal("oversized body was accepted")
	}
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("got %d, want 413", rec.Code)
	}

	small := httptest.NewRequest(http.MethodPost, "/transactions", bytes.NewBufferString(`{"note":"ok"}`))
	if !decodeBody(httptest.NewRecorder(), small, &target) {
		t.Fatal("small body was rejected")
	}
}
