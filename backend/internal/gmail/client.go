package gmail

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type APIError struct {
	Status int
	Code   string
}

func (e *APIError) Error() string { return fmt.Sprintf("%s_%d", e.Code, e.Status) }

type Client struct {
	HTTP  *http.Client
	Token string
}

func NewClient(token string) *Client {
	return &Client{HTTP: &http.Client{Timeout: 15 * time.Second}, Token: token}
}

func (c *Client) request(ctx context.Context, method, path string, body any, out any) error {
	var data io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		data = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, "https://gmail.googleapis.com/gmail/v1/users/me/"+path, data)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("gmail_unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &APIError{resp.StatusCode, "gmail"}
	}
	if out == nil {
		return nil
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("gmail_read_failed")
	}
	if err := json.Unmarshal(b, out); err != nil {
		return fmt.Errorf("gmail_invalid_response")
	}
	return nil
}

type Profile struct {
	Email     string `json:"emailAddress"`
	HistoryID string `json:"historyId"`
}

func (c *Client) Profile(ctx context.Context) (Profile, error) {
	var p Profile
	err := c.request(ctx, "GET", "profile", nil, &p)
	return p, err
}

type Message struct {
	ID           string   `json:"id"`
	InternalDate string   `json:"internalDate"`
	Raw          string   `json:"raw"`
	LabelIDs     []string `json:"labelIds"`
	Payload      struct {
		Headers []struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"headers"`
	} `json:"payload"`
}

func (c *Client) Message(ctx context.Context, id, format string) (Message, error) {
	var m Message
	err := c.request(ctx, "GET", "messages/"+url.PathEscape(id)+"?format="+format, nil, &m)
	return m, err
}
func (m Message) Bytes() ([]byte, error) {
	b, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(m.Raw, "="))
	if err != nil {
		return nil, fmt.Errorf("invalid_raw_email")
	}
	return b, nil
}

type History struct {
	HistoryID     string `json:"historyId"`
	NextPageToken string `json:"nextPageToken"`
	History       []struct {
		Added []struct {
			Message Message `json:"message"`
		} `json:"messagesAdded"`
	} `json:"history"`
}

func (c *Client) History(ctx context.Context, start, page string) (History, error) {
	q := url.Values{"startHistoryId": {start}, "maxResults": {"10"}, "historyTypes": {"messageAdded"}}
	if page != "" {
		q.Set("pageToken", page)
	}
	var h History
	err := c.request(ctx, "GET", "history?"+q.Encode(), nil, &h)
	return h, err
}

type Messages struct {
	Messages      []Message `json:"messages"`
	NextPageToken string    `json:"nextPageToken"`
}

func (c *Client) Search(ctx context.Context, after time.Time, page string) (Messages, error) {
	q := url.Values{"q": {fmt.Sprintf("%s after:%d", Query, after.Unix())}, "maxResults": {"10"}}
	if page != "" {
		q.Set("pageToken", page)
	}
	var m Messages
	err := c.request(ctx, "GET", "messages?"+q.Encode(), nil, &m)
	return m, err
}

type Watch struct {
	HistoryID  string `json:"historyId"`
	Expiration string `json:"expiration"`
}

func (c *Client) Watch(ctx context.Context, topic string) (Watch, error) {
	// Watch the mailbox, not just INBOX: user filters may archive bank receipts.
	var w Watch
	err := c.request(ctx, "POST", "watch", map[string]string{"topicName": topic}, &w)
	return w, err
}
func (c *Client) Stop(ctx context.Context) error { return c.request(ctx, "POST", "stop", nil, nil) }

type Token struct {
	Access  string `json:"access_token"`
	Refresh string `json:"refresh_token"`
	Scope   string `json:"scope"`
}

func Exchange(ctx context.Context, httpClient *http.Client, values url.Values) (Token, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", "https://oauth2.googleapis.com/token", strings.NewReader(values.Encode()))
	if err != nil {
		return Token{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := httpClient.Do(req)
	if err != nil {
		return Token{}, fmt.Errorf("oauth_unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		var failure struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&failure)
		if failure.Error == "invalid_grant" {
			return Token{}, &APIError{401, "reauthorization_required"}
		}
		return Token{}, &APIError{resp.StatusCode, "oauth"}
	}
	var t Token
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&t); err != nil || t.Access == "" {
		return Token{}, fmt.Errorf("oauth_invalid_response")
	}
	return t, nil
}
func Revoke(ctx context.Context, token string) error {
	req, _ := http.NewRequestWithContext(ctx, "POST", "https://oauth2.googleapis.com/revoke", strings.NewReader(url.Values{"token": {token}}.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return fmt.Errorf("revocation_unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("revocation_failed")
	}
	return nil
}
