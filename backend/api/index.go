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

var (
	mu     sync.Mutex
	router http.Handler
)

func Handler(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	if router == nil {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		db, err := postgres.Connect(ctx, os.Getenv("DATABASE_URL"))
		if err != nil {
			mu.Unlock()
			http.Error(w, "database connection unavailable", http.StatusServiceUnavailable)
			return
		}
		router = httpserver.NewRouter(slog.New(slog.NewTextHandler(os.Stdout, nil)), db)
	}
	currentRouter := router
	mu.Unlock()
	currentRouter.ServeHTTP(w, r)
}
