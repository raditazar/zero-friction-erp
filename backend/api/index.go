package handler

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"zero-friction-erp/backend/internal/httpserver"
	"zero-friction-erp/backend/internal/postgres"
)

const (
	connectAttempts = 3
	connectTimeout  = 5 * time.Second
)

var (
	mu     sync.Mutex
	router http.Handler
)

// connectWithRetry absorbs transient pooler failures typical of serverless
// cold starts (2 retries, short backoff).
func connectWithRetry(ctx context.Context, logger *slog.Logger) (http.Handler, error) {
	start := time.Now()
	var lastErr error
	for attempt := 1; attempt <= connectAttempts; attempt++ {
		attemptCtx, cancel := context.WithTimeout(ctx, connectTimeout)
		db, err := postgres.Connect(attemptCtx, os.Getenv("DATABASE_URL"))
		cancel()
		if err == nil {
			logger.Info("cold start: database connected", "attempt", attempt, "duration_ms", time.Since(start).Milliseconds())
			return httpserver.NewRouter(logger, db), nil
		}
		lastErr = err
		logger.Warn("cold start: database connect failed", "attempt", attempt, "error", err)
		if attempt < connectAttempts {
			select {
			case <-time.After(time.Duration(attempt) * 200 * time.Millisecond):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
	}
	return nil, lastErr
}

func Handler(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	if router == nil {
		logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
		h, err := connectWithRetry(r.Context(), logger)
		if err != nil {
			mu.Unlock()
			http.Error(w, "database connection unavailable", http.StatusServiceUnavailable)
			return
		}
		router = h
	}
	currentRouter := router
	mu.Unlock()
	currentRouter.ServeHTTP(w, r)
}
