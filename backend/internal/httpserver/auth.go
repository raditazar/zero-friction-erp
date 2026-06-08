package httpserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type contextKey string

const userIDContextKey contextKey = "user_id"

type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	IDToken      string `json:"id_token"`
}

type googleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (s *Server) registerAuth(mux *http.ServeMux) {
	mux.HandleFunc("GET /auth/google/login", s.handleGoogleLogin)
	mux.HandleFunc("GET /auth/google/callback", s.handleGoogleCallback)
	mux.HandleFunc("POST /auth/logout", s.handleLogout)
}

func (s *Server) withUserAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.allowDevelopmentFallback(w, r, next) {
			return
		}
		if token := bearerToken(r); strings.HasPrefix(token, "zfe_api_") {
			userID, err := s.validateAPIKey(r, token)
			if err != nil {
				s.writeAuthError(w, err)
				return
			}
			next.ServeHTTP(w, withUserID(r, userID))
			return
		}
		if cookie, err := r.Cookie("zfe_session"); err == nil && strings.TrimSpace(cookie.Value) != "" {
			userID, err := s.validateSession(r, cookie.Value)
			if err != nil {
				s.writeAuthError(w, err)
				return
			}
			next.ServeHTTP(w, withUserID(r, userID))
			return
		}
		writeError(w, http.StatusUnauthorized, "valid session cookie or API token is required")
	})
}

func (s *Server) withWebhookAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.allowDevelopmentFallback(w, r, http.HandlerFunc(next)) {
			return
		}
		token := bearerToken(r)
		if token == "" {
			token = strings.TrimSpace(r.Header.Get("X-Webhook-Token"))
		}
		if !strings.HasPrefix(token, "zfe_wh_") {
			writeError(w, http.StatusUnauthorized, "valid webhook token is required")
			return
		}
		userID, err := s.validateWebhookToken(r, token)
		if err != nil {
			s.writeAuthError(w, err)
			return
		}
		next(w, withUserID(r, userID))
	}
}

func (s *Server) allowDevelopmentFallback(w http.ResponseWriter, r *http.Request, next http.Handler) bool {
	if appEnv() != "development" {
		return false
	}
	if r.URL.Path == "/api-keys" || r.URL.Path == "/webhook-tokens" {
		return false
	}
	if hasAuthMaterial(r) {
		return false
	}
	next.ServeHTTP(w, withUserID(r, demoUserID))
	return true
}

func hasAuthMaterial(r *http.Request) bool {
	if bearerToken(r) != "" || strings.TrimSpace(r.Header.Get("X-Webhook-Token")) != "" {
		return true
	}
	_, err := r.Cookie("zfe_session")
	return err == nil
}

func (s *Server) validateAPIKey(r *http.Request, token string) (string, error) {
	if s.db == nil {
		return "", fmt.Errorf("database is not configured")
	}
	hash := hashSecret(token)
	var userID string
	err := s.db.QueryRow(r.Context(), `
		update api_keys
		set last_used_at = now()
		where key_hash = $1 and deleted_at is null and revoked_at is null and (expires_at is null or expires_at > now())
		returning user_id::text
	`, hash).Scan(&userID)
	return userID, err
}

func (s *Server) validateWebhookToken(r *http.Request, token string) (string, error) {
	if s.db == nil {
		return "", fmt.Errorf("database is not configured")
	}
	hash := hashSecret(token)
	var userID string
	err := s.db.QueryRow(r.Context(), `
		update webhook_tokens
		set last_used_at = now()
		where token_hash = $1 and deleted_at is null and revoked_at is null and (expires_at is null or expires_at > now())
		returning user_id::text
	`, hash).Scan(&userID)
	return userID, err
}

func (s *Server) validateSession(r *http.Request, sessionToken string) (string, error) {
	if s.db == nil {
		return "", fmt.Errorf("database is not configured")
	}
	hash := hashSecret(sessionToken)
	var userID string
	err := s.db.QueryRow(r.Context(), `
		update auth_sessions
		set last_seen_at = now()
		where session_hash = $1 and deleted_at is null and revoked_at is null and expires_at > now()
		returning user_id::text
	`, hash).Scan(&userID)
	return userID, err
}

func (s *Server) writeAuthError(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	if strings.Contains(err.Error(), "database is not configured") {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	writeError(w, http.StatusUnauthorized, "invalid or expired credential")
}

func (s *Server) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	clientID := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET"))
	redirectURL := strings.TrimSpace(os.Getenv("GOOGLE_REDIRECT_URL"))
	if clientID == "" || clientSecret == "" || redirectURL == "" {
		writeError(w, http.StatusServiceUnavailable, "Google OAuth is not configured")
		return
	}
	state, err := randomToken("zfe_state")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate OAuth state")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "zfe_oauth_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   appEnv() == "production",
		SameSite: http.SameSiteLaxMode,
	})
	values := url.Values{}
	values.Set("client_id", clientID)
	values.Set("redirect_uri", redirectURL)
	values.Set("response_type", "code")
	values.Set("scope", "openid email profile")
	values.Set("state", state)
	values.Set("access_type", "offline")
	values.Set("prompt", "consent")
	http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+values.Encode(), http.StatusFound)
}

func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	stateCookie, err := r.Cookie("zfe_oauth_state")
	if err != nil || stateCookie.Value == "" || stateCookie.Value != r.URL.Query().Get("state") {
		writeError(w, http.StatusBadRequest, "invalid OAuth state")
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		writeError(w, http.StatusBadRequest, "OAuth code is required")
		return
	}
	tokenResponse, err := exchangeGoogleCode(r, code)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	userInfo, err := fetchGoogleUserInfo(r, tokenResponse.AccessToken)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	if userInfo.Email == "" || userInfo.ID == "" {
		writeError(w, http.StatusBadGateway, "Google profile is missing email or id")
		return
	}
	accessHash := ""
	if tokenResponse.AccessToken != "" {
		accessHash = hashSecret(tokenResponse.AccessToken)
	}
	refreshHash := ""
	if tokenResponse.RefreshToken != "" {
		refreshHash = hashSecret(tokenResponse.RefreshToken)
	}
	tokenExpiresAt := time.Now().UTC().Add(time.Duration(tokenResponse.ExpiresIn) * time.Second)
	var userID string
	err = s.db.QueryRow(r.Context(), `
		with upserted_user as (
			insert into users (email)
			values ($1)
			on conflict (email) do update set email = excluded.email
			returning id
		),
		upserted_profile as (
			insert into profiles (id, full_name, avatar)
			select id, $2, $3 from upserted_user
			on conflict (id) do update set
				full_name = coalesce(excluded.full_name, profiles.full_name),
				avatar = coalesce(excluded.avatar, profiles.avatar)
			returning id
		),
		upserted_oauth as (
			insert into oauth_accounts (
				user_id, provider, provider_user_id, email, email_verified, name, avatar_url,
				access_token_hash, refresh_token_hash, token_expires_at, deleted_at
			)
			select id, 'google', $4, $1, $5, $2, $3, nullif($6, ''), nullif($7, ''), $8, null from upserted_user
			on conflict (provider, provider_user_id) do update set
				user_id = excluded.user_id,
				email = excluded.email,
				email_verified = excluded.email_verified,
				name = excluded.name,
				avatar_url = excluded.avatar_url,
				access_token_hash = excluded.access_token_hash,
				refresh_token_hash = coalesce(excluded.refresh_token_hash, oauth_accounts.refresh_token_hash),
				token_expires_at = excluded.token_expires_at,
				deleted_at = null
			returning user_id
		)
		select user_id::text from upserted_oauth
	`, userInfo.Email, nullableString(userInfo.Name), nullableString(userInfo.Picture), userInfo.ID, userInfo.EmailVerified, accessHash, refreshHash, tokenExpiresAt).Scan(&userID)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	if _, err := s.ensureStarterWorkspace(r, userID); err != nil {
		s.writeDBError(w, err)
		return
	}
	sessionToken, err := randomToken("zfe_session")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate session")
		return
	}
	sessionExpiresAt := time.Now().UTC().Add(30 * 24 * time.Hour)
	err = s.db.QueryRow(r.Context(), `
		insert into auth_sessions (user_id, session_hash, user_agent, ip_address, expires_at)
		values ($1, $2, $3, nullif($4, '')::inet, $5)
		returning id
	`, userID, hashSecret(sessionToken), r.UserAgent(), clientIP(r), sessionExpiresAt).Scan(new(string))
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "zfe_session",
		Value:    sessionToken,
		Path:     "/",
		MaxAge:   int(time.Until(sessionExpiresAt).Seconds()),
		HttpOnly: true,
		Secure:   appEnv() == "production",
		SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(w, &http.Cookie{Name: "zfe_oauth_state", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	if frontendURL := strings.TrimSpace(os.Getenv("FRONTEND_URL")); frontendURL != "" {
		http.Redirect(w, r, frontendURL, http.StatusFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "authenticated"})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("zfe_session"); err == nil && s.db != nil {
		_ = s.db.QueryRow(r.Context(), `
			update auth_sessions
			set revoked_at = now(), deleted_at = now()
			where session_hash = $1 and deleted_at is null
			returning id
		`, hashSecret(cookie.Value)).Scan(new(string))
	}
	http.SetCookie(w, &http.Cookie{Name: "zfe_session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

func exchangeGoogleCode(r *http.Request, code string) (googleTokenResponse, error) {
	values := url.Values{}
	values.Set("code", code)
	values.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	values.Set("client_secret", os.Getenv("GOOGLE_CLIENT_SECRET"))
	values.Set("redirect_uri", os.Getenv("GOOGLE_REDIRECT_URL"))
	values.Set("grant_type", "authorization_code")
	request, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(values.Encode()))
	if err != nil {
		return googleTokenResponse{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := (&http.Client{Timeout: 20 * time.Second}).Do(request)
	if err != nil {
		return googleTokenResponse{}, err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return googleTokenResponse{}, fmt.Errorf("Google token exchange failed with status %d: %s", response.StatusCode, googleOAuthError(body))
	}
	var parsed googleTokenResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return googleTokenResponse{}, err
	}
	return parsed, nil
}

func googleOAuthError(body []byte) string {
	var parsed struct {
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &parsed); err == nil && parsed.Error != "" {
		if parsed.ErrorDescription != "" {
			return parsed.Error + " - " + parsed.ErrorDescription
		}
		return parsed.Error
	}
	text := strings.TrimSpace(string(body))
	if text == "" {
		return "empty response body"
	}
	if len(text) > 240 {
		return text[:240]
	}
	return text
}

func fetchGoogleUserInfo(r *http.Request, accessToken string) (googleUserInfo, error) {
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return googleUserInfo{}, err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	response, err := (&http.Client{Timeout: 20 * time.Second}).Do(request)
	if err != nil {
		return googleUserInfo{}, err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return googleUserInfo{}, fmt.Errorf("Google userinfo failed with status %d", response.StatusCode)
	}
	var parsed googleUserInfo
	if err := json.Unmarshal(body, &parsed); err != nil {
		return googleUserInfo{}, err
	}
	return parsed, nil
}

func withUserID(r *http.Request, userID string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), userIDContextKey, userID))
}

func userID(r *http.Request) string {
	if value, ok := r.Context().Value(userIDContextKey).(string); ok && value != "" {
		return value
	}
	return demoUserID
}

func bearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if header == "" {
		return ""
	}
	prefix := "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}

func hashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func randomToken(prefix string) (string, error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	return prefix + "_" + base64.RawURLEncoding.EncodeToString(randomBytes), nil
}

func appEnv() string {
	return strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func clientIP(r *http.Request) string {
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		return strings.TrimSpace(strings.Split(forwardedFor, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
