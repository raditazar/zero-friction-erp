package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"zero-friction-erp/backend/internal/gmail"
)

type gmailRoundTripper func(*http.Request) (*http.Response, error)

func (f gmailRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func gmailJSON(value any, status int) *http.Response {
	b, _ := json.Marshal(value)
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(b)))}
}

func TestGmailOAuthBindsIdentityAndConsumesState(t *testing.T) {
	pool := gmailTestDB(t)
	c := gmailTestConnection(t, pool)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `insert into oauth_accounts(user_id,provider,provider_user_id,email,email_verified) values($1,'google','google-owner','gmail-demo@example.invalid',true); insert into auth_sessions(user_id,session_hash,expires_at) values($1,$2,now()+interval '1 hour')`, c.UserID, hashSecret("test-session"))
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("GOOGLE_CLIENT_ID", "demo-client")
	t.Setenv("GOOGLE_CLIENT_SECRET", "demo-secret")
	t.Setenv("GMAIL_REDIRECT_URL", "https://example.invalid/api/backend/integrations/gmail/callback")
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	identity := "google-owner"
	http.DefaultTransport = gmailRoundTripper(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path == "/token" {
			return gmailJSON(map[string]string{"access_token": "access-demo", "refresh_token": "new-refresh-demo", "scope": gmailScope}, 200), nil
		}
		if r.URL.Path == "/oauth2/v2/userinfo" {
			return gmailJSON(map[string]any{"id": identity, "email": c.Email, "verified_email": true}, 200), nil
		}
		return nil, fmt.Errorf("unexpected OAuth request")
	})
	router := NewRouter(slog.Default(), pool)
	request := func(path string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", path, nil)
		r.AddCookie(&http.Cookie{Name: "zfe_session", Value: "test-session"})
		for _, cookie := range cookies {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	for _, mismatch := range []bool{true, false} {
		w := request("/integrations/gmail/connect")
		if w.Code != 302 {
			t.Fatal(w.Code, w.Body.String())
		}
		location, _ := url.Parse(w.Header().Get("Location"))
		state := location.Query().Get("state")
		if state == "" || !strings.Contains(location.Query().Get("scope"), gmailScope) {
			t.Fatal("missing state/scope")
		}
		if mismatch {
			identity = "different-google-account"
		} else {
			identity = "google-owner"
		}
		callback := "/integrations/gmail/callback?state=" + url.QueryEscape(state) + "&code=demo-code"
		w = request(callback, w.Result().Cookies()...)
		want := 200
		if mismatch {
			want = 403
		}
		if w.Code != want {
			t.Fatal(w.Code, w.Body.String())
		}
		// State cannot be replayed even after an identity mismatch.
		w = request(callback, &http.Cookie{Name: "zfe_gmail_state", Value: state})
		if w.Code != 400 {
			t.Fatal("replay", w.Code)
		}
	}
	loaded, err := (&Server{db: pool}).gmailLoad(ctx, c.UserID)
	if err != nil || loaded.HistoryID != "10" || !loaded.Enabled {
		t.Fatal("reconnect changed activation", err)
	}
	plaintext, err := gmail.Open(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), loaded.Cipher, c.UserID+":token")
	if err != nil || plaintext != "new-refresh-demo" {
		t.Fatal("credential not stored encrypted", err)
	}
}

func TestGmailRefreshRevokedAndDisconnect(t *testing.T) {
	pool := gmailTestDB(t)
	c := gmailTestConnection(t, pool)
	s := &Server{db: pool}
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	http.DefaultTransport = gmailRoundTripper(func(r *http.Request) (*http.Response, error) {
		return gmailJSON(map[string]string{"error": "invalid_grant"}, 400), nil
	})
	if _, err := s.gmailClient(context.Background(), c); err == nil || !strings.Contains(err.Error(), "reauthorization_required") {
		t.Fatal(err)
	}
	r := withUserID(httptest.NewRequest("DELETE", "/integrations/gmail/connection", nil), c.UserID)
	w := httptest.NewRecorder()
	s.gmailDisconnect(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	loaded, err := s.gmailLoad(context.Background(), c.UserID)
	if err != nil || loaded.Cipher != "" || loaded.Enabled {
		t.Fatal("disconnect retained credential or enabled sync", err)
	}
}

// Opt in with a disposable local DB. Every test owns a unique schema; never
// bootstrap or reset the configured development/production database.
func gmailTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("GMAIL_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set GMAIL_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if config.ConnConfig.Host != "127.0.0.1" && config.ConnConfig.Host != "localhost" {
		t.Fatal("tests require local disposable PostgreSQL")
	}
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	admin, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("gmail_test_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "create schema "+quoted); err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "drop schema "+quoted+" cascade")
		admin.Close()
	})
	for _, name := range []string{"001_initial_schema.sql", "003_google_oauth.sql", "007_gmail_integration.sql"} {
		b, err := os.ReadFile("../../../database/migrations/" + name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(b)); err != nil {
			t.Fatal(name, err)
		}
	}
	return pool
}
func gmailTestConnection(t *testing.T, pool *pgxpool.Pool) gmailConnection {
	t.Helper()
	ctx := context.Background()
	var uid, wid string
	if err := pool.QueryRow(ctx, `insert into users(email) values('gmail-demo@example.invalid') returning id::text`).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `insert into wallets(user_id,name,category,currency,init_balance) values($1,'UJI Gmail','bank','IDR',0) returning id::text`, uid).Scan(&wid); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GMAIL_TOKEN_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(make([]byte, 32)))
	t.Setenv("GMAIL_OWNER_EMAIL", "gmail-demo@example.invalid")
	token, _ := gmail.Seal(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), "refresh-test", uid+":token")
	account, _ := gmail.Seal(os.Getenv("GMAIL_TOKEN_ENCRYPTION_KEY"), "1234567890", uid+":account")
	var id string
	if err := pool.QueryRow(ctx, `insert into gmail_connections(user_id,email,refresh_token_ciphertext,wallet_id,recipient_account_ciphertext,enabled,test_mode,activated_at,history_id) values($1,'gmail-demo@example.invalid',$2,$3,$4,true,true,'2026-10-01','10') returning id::text`, uid, token, wid, account).Scan(&id); err != nil {
		t.Fatal(err)
	}
	s := &Server{db: pool}
	c, err := s.gmailLoad(ctx, uid)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestGmailAtomicDraftAndConcurrency(t *testing.T) {
	pool := gmailTestDB(t)
	c := gmailTestConnection(t, pool)
	s := &Server{db: pool}
	ctx := context.Background()
	b, err := os.ReadFile("../gmail/testdata/cimb-synthetic.eml")
	if err != nil {
		t.Fatal(err)
	}
	receipt, err := gmail.Parse(b, true)
	if err != nil {
		t.Fatal(err)
	}
	lease, err := s.gmailLease(ctx, c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.gmailLease(ctx, c.ID); err == nil {
		t.Fatal("concurrent lease accepted")
	}
	var wg sync.WaitGroup
	results := make(chan string, 2)
	errs := make(chan error, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := s.gmailRecord(ctx, c, lease, "same-message", "imported", "", nil, &receipt)
			results <- result
			errs <- err
		}()
	}
	wg.Wait()
	for range 2 {
		if err := <-errs; err != nil {
			t.Fatal(err)
		}
	}
	first, second := <-results, <-results
	if !((first == "imported" && second == "duplicate") || (second == "imported" && first == "duplicate")) {
		t.Fatal(first, second)
	}
	var count int
	var balance string
	if err := pool.QueryRow(ctx, `select count(*) from transactions`).Scan(&count); err != nil || count != 1 {
		t.Fatal(count, err)
	}
	if err := pool.QueryRow(ctx, `select curr_balance::text from wallet_balances where user_id=$1`, c.UserID).Scan(&balance); err != nil || balance != "0.00" {
		t.Fatal(balance, err)
	}
	// Force a wallet error after transaction begins: no processed message survives.
	broken := c
	broken.WalletID = "00000000-0000-0000-0000-000000000000"
	if _, err := s.gmailRecord(ctx, broken, lease, "rollback-message", "imported", "", nil, &receipt); err == nil {
		t.Fatal("invalid wallet accepted")
	}
	if err := pool.QueryRow(ctx, `select count(*) from gmail_messages where message_id='rollback-message'`).Scan(&count); err != nil || count != 0 {
		t.Fatal(count, err)
	}
	_, _ = pool.Exec(ctx, `update transactions set status='rejected',deleted_at=now()`)
	if status, err := s.gmailRecord(ctx, c, lease, "same-message", "imported", "", nil, &receipt); err != nil || status != "duplicate" {
		t.Fatal(status, err)
	}
	_, _ = pool.Exec(ctx, `update transactions set status='approved',deleted_at=null`)
	if err := pool.QueryRow(ctx, `select curr_balance::text from wallet_balances where user_id=$1`, c.UserID).Scan(&balance); err != nil || balance != "25000.00" {
		t.Fatal(balance, err)
	}
	s.gmailRelease(ctx, c.ID, lease)
}

func TestGmailSyncRecoveryAndPermanentFailures(t *testing.T) {
	pool := gmailTestDB(t)
	c := gmailTestConnection(t, pool)
	s := &Server{db: pool, logger: slog.Default()}
	b, _ := os.ReadFile("../gmail/testdata/cimb-synthetic.eml")
	raw := base64.RawURLEncoding.EncodeToString(b)
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	recovering := true
	http.DefaultTransport = gmailRoundTripper(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/token":
			return gmailJSON(map[string]string{"access_token": "access-demo"}, 200), nil
		case "/gmail/v1/users/me/history":
			if recovering {
				return gmailJSON(map[string]string{"error": "expired"}, 404), nil
			}
			return gmailJSON(map[string]any{"historyId": "30", "history": []any{map[string]any{"messagesAdded": []any{map[string]any{"message": map[string]string{"id": "good"}}, map[string]any{"message": map[string]string{"id": "bad"}}}}}}, 200), nil
		case "/gmail/v1/users/me/profile":
			return gmailJSON(map[string]string{"historyId": "20", "emailAddress": c.Email}, 200), nil
		case "/gmail/v1/users/me/messages":
			return gmailJSON(map[string]any{"messages": []any{map[string]string{"id": "good"}, map[string]string{"id": "bad"}}}, 200), nil
		case "/gmail/v1/users/me/messages/good", "/gmail/v1/users/me/messages/bad":
			if r.URL.Query().Get("format") == "metadata" {
				return gmailJSON(map[string]any{"internalDate": "1791265520000", "payload": map[string]any{"headers": []any{map[string]string{"name": "From", "value": gmail.Sender}, map[string]string{"name": "Subject", "value": gmail.Subject}}}}, 200), nil
			}
			value := raw
			if strings.HasSuffix(r.URL.Path, "/bad") {
				value = base64.RawURLEncoding.EncodeToString([]byte(strings.ReplaceAll(string(b), "1234567890", "9999999999")))
			}
			return gmailJSON(map[string]string{"raw": value}, 200), nil
		default:
			return nil, fmt.Errorf("unexpected request path %s", r.URL.Path)
		}
	})
	result, err := s.gmailSync(context.Background(), c)
	if err != nil || result.Imported != 1 || result.Failed != 1 {
		t.Fatal(result, err)
	}
	c, err = s.gmailLoad(context.Background(), c.UserID)
	if err != nil || c.HistoryID != "20" || c.RecoveryID != "" {
		t.Fatal(c.HistoryID, c.RecoveryID, err)
	}
	recovering = false
	result, err = s.gmailSync(context.Background(), c)
	if err != nil || result.Imported != 0 {
		t.Fatal(result, err)
	}
	c, _ = s.gmailLoad(context.Background(), c.UserID)
	if c.HistoryID != "30" {
		t.Fatal(c.HistoryID)
	}
	var code string
	if err := pool.QueryRow(context.Background(), `select error_code from gmail_messages where message_id='bad'`).Scan(&code); err != nil || code != "recipient_account_mismatch" {
		t.Fatal(code, err)
	}
}

func TestGmailPreviewDoesNotWrite(t *testing.T) {
	pool := gmailTestDB(t)
	c := gmailTestConnection(t, pool)
	s := &Server{db: pool}
	b, _ := os.ReadFile("../gmail/testdata/cimb-synthetic.eml")
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	http.DefaultTransport = gmailRoundTripper(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path == "/token" {
			return gmailJSON(map[string]string{"access_token": "access-demo"}, 200), nil
		}
		return gmailJSON(map[string]string{"raw": base64.RawURLEncoding.EncodeToString(b)}, 200), nil
	})
	r := withUserID(httptest.NewRequest("POST", "/integrations/gmail/preview", strings.NewReader(`{"message_id":"old-message"}`)), c.UserID)
	w := httptest.NewRecorder()
	s.gmailPreview(w, r)
	if w.Code != 200 || strings.Contains(w.Body.String(), "1234567890") || !strings.Contains(w.Body.String(), "writes_transaction") {
		t.Fatal(w.Code, w.Body.String())
	}
	var count int
	_ = pool.QueryRow(context.Background(), `select count(*) from transactions`).Scan(&count)
	if count != 0 {
		t.Fatal(count)
	}
	loaded, _ := s.gmailLoad(context.Background(), c.UserID)
	if loaded.HistoryID != c.HistoryID {
		t.Fatal("preview moved cursor")
	}
	statusResponse := httptest.NewRecorder()
	s.gmailStatus(statusResponse, withUserID(httptest.NewRequest("GET", "/integrations/gmail/status", nil), c.UserID))
	if statusResponse.Code != 200 || strings.Contains(statusResponse.Body.String(), c.Cipher) || strings.Contains(statusResponse.Body.String(), c.AccountCipher) {
		t.Fatal("status leaked credential or failed", statusResponse.Code)
	}
}

func TestGmailBoundedResumeAndWatchRenewal(t *testing.T) {
	pool := gmailTestDB(t)
	c := gmailTestConnection(t, pool)
	s := &Server{db: pool}
	b, _ := os.ReadFile("../gmail/testdata/cimb-synthetic.eml")
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	t.Setenv("GMAIL_PUBSUB_TOPIC", "projects/demo/topics/erp-gmail")
	watchCalls := 0
	transient := false
	_, err := pool.Exec(context.Background(), `update gmail_connections set page_token='expired' where id=$1`, c.ID)
	if err != nil {
		t.Fatal(err)
	}
	http.DefaultTransport = gmailRoundTripper(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/token":
			return gmailJSON(map[string]string{"access_token": "access-demo"}, 200), nil
		case "/gmail/v1/users/me/watch":
			watchCalls++
			return gmailJSON(map[string]string{"historyId": "999", "expiration": fmt.Sprint(time.Now().Add(7 * 24 * time.Hour).UnixMilli())}, 200), nil
		case "/gmail/v1/users/me/history":
			if r.URL.Query().Get("pageToken") == "expired" {
				return gmailJSON(map[string]string{"error": "expired page"}, 400), nil
			}
			if r.URL.Query().Get("startHistoryId") != "10" {
				t.Fatal("watch renewal overwrote cursor")
			}
			added := make([]any, 0, 12)
			for i := range 12 {
				added = append(added, map[string]any{"message": map[string]string{"id": fmt.Sprintf("message%d", i)}})
			}
			return gmailJSON(map[string]any{"historyId": "30", "history": []any{map[string]any{"messagesAdded": added}}}, 200), nil
		default:
			if transient {
				return gmailJSON(map[string]string{"error": "temporary"}, 503), nil
			}
			if r.URL.Query().Get("format") == "metadata" {
				return gmailJSON(map[string]any{"internalDate": "1791265520000", "payload": map[string]any{"headers": []any{map[string]string{"name": "From", "value": gmail.Sender}, map[string]string{"name": "Subject", "value": gmail.Subject}}}}, 200), nil
			}
			return gmailJSON(map[string]string{"raw": base64.RawURLEncoding.EncodeToString(b)}, 200), nil
		}
	})
	if _, err := s.gmailSync(context.Background(), c); err == nil {
		t.Fatal("expired page error swallowed")
	}
	reset, _ := s.gmailLoad(context.Background(), c.UserID)
	if reset.PageToken != "" || reset.HistoryID != "10" {
		t.Fatal("expired page reset advanced cursor")
	}
	transient = true
	if _, err := s.gmailSync(context.Background(), c); err == nil {
		t.Fatal("transient error swallowed")
	}
	loaded, _ := s.gmailLoad(context.Background(), c.UserID)
	if loaded.HistoryID != "10" {
		t.Fatal("transient error advanced cursor")
	}
	transient = false
	result, err := s.gmailSync(context.Background(), loaded)
	if err != nil || result.Imported != 10 || !result.More {
		t.Fatal(result, err)
	}
	loaded, _ = s.gmailLoad(context.Background(), c.UserID)
	if loaded.HistoryID != "10" {
		t.Fatal("partial page advanced cursor")
	}
	result, err = s.gmailSync(context.Background(), loaded)
	if err != nil || result.Imported != 2 || result.More {
		t.Fatal(result, err)
	}
	loaded, _ = s.gmailLoad(context.Background(), c.UserID)
	if loaded.HistoryID != "30" || watchCalls != 1 || loaded.WatchExpiresAt == nil {
		t.Fatal("resume/renewal incorrect", loaded.HistoryID, watchCalls)
	}
}
