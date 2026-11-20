package httpserver

import (
	"context"
	"net/http"
	"strconv"
	"time"
)

// rateLimit describes how many calls one user may make to a bucket per window.
type rateLimit struct {
	bucket string
	limit  int
	window time.Duration
}

// Gemini calls cost money per request, so they are capped per user. The numbers are generous
// for one person capturing receipts and tight enough to stop a leaked token or a looping
// Shortcut from running up the bill.
var (
	aiExtractLimit    = rateLimit{bucket: "ai_extract", limit: 40, window: 10 * time.Minute}
	aiCategorizeLimit = rateLimit{bucket: "ai_categorize", limit: 120, window: 10 * time.Minute}
)

// allowRate counts one hit for the user in the current fixed window and reports whether the
// call may proceed. The counter lives in Postgres because serverless instances do not share
// memory. It fails open: if the table is missing (migration 013 not applied yet) or the
// database errors, the request is allowed and the error is logged.
func (s *Server) allowRate(ctx context.Context, userID string, rl rateLimit) (allowed bool, retryAfter time.Duration) {
	if s.db == nil || userID == "" {
		return true, 0
	}
	seconds := int64(rl.window / time.Second)
	var hits int
	var windowEnd time.Time
	err := s.db.QueryRow(ctx, `
		with cleanup as (
			delete from api_rate_limits
			where user_id = $1 and bucket = $2 and window_start < now() - interval '1 day'
		)
		insert into api_rate_limits (user_id, bucket, window_start, hits)
		values ($1, $2, to_timestamp(floor(extract(epoch from now()) / $3) * $3), 1)
		on conflict (user_id, bucket, window_start)
		do update set hits = api_rate_limits.hits + 1
		returning hits, window_start + make_interval(secs => $3)
	`, userID, rl.bucket, seconds).Scan(&hits, &windowEnd)
	if err != nil {
		s.logger.Warn("rate limit check failed, allowing request", "bucket", rl.bucket, "error", err)
		return true, 0
	}
	if hits > rl.limit {
		return false, time.Until(windowEnd)
	}
	return true, 0
}

// enforceRate writes a 429 with Retry-After and returns false when the user is over the limit.
func (s *Server) enforceRate(w http.ResponseWriter, r *http.Request, rl rateLimit) bool {
	allowed, retryAfter := s.allowRate(r.Context(), userID(r), rl)
	if allowed {
		return true
	}
	secs := int(retryAfter.Seconds()) + 1
	if secs < 1 {
		secs = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(secs))
	writeError(w, http.StatusTooManyRequests, "too many requests, try again in a few minutes")
	return false
}
