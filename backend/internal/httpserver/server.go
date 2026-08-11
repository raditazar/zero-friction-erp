package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

const maxWebhookBodyBytes = 1 << 20
const version = "0.1.0"

type response struct {
	Status   string `json:"status"`
	Database string `json:"database,omitempty"`
}

type versionResponse struct {
	Version string `json:"version"`
}

type webhookResponse struct {
	Status     string    `json:"status"`
	ReceivedAt time.Time `json:"receivedAt"`
}

type notImplementedResponse struct {
	Status   string            `json:"status"`
	Method   string            `json:"method"`
	Path     string            `json:"path"`
	Resource string            `json:"resource"`
	Action   string            `json:"action"`
	Params   map[string]string `json:"params,omitempty"`
}

type pingable interface {
	Ping(ctx context.Context) error
}

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type Server struct {
	logger *slog.Logger
	db     rowQuerier
}

type endpoint struct {
	Method   string
	Pattern  string
	Resource string
	Action   string
	Params   []string
}

func NewRouter(logger *slog.Logger, db pingable) http.Handler {
	server := &Server{logger: logger}
	if querier, ok := db.(rowQuerier); ok {
		server.db = querier
	}
	mux := http.NewServeMux()
	protectedMux := http.NewServeMux()

	registerReadiness(mux, logger, db)
	registerVersion(mux)
	server.registerAuth(mux)
	server.registerWebhook(mux)
	server.registerResources(protectedMux)
	server.registerExtendedResources(protectedMux)
	server.registerBudgets(protectedMux)
	server.registerAIAndAnalytics(protectedMux)
	registerStubs(protectedMux, endpoints())
	mux.Handle("/", server.withUserAuth(protectedMux))

	return mux
}

func registerReadiness(mux *http.ServeMux, logger *slog.Logger, db pingable) {
	healthHandler := func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, response{Status: "ok"})
	}

	readyHandler := func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusOK, response{Status: "ok"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			logger.Error("database health check failed", "error", err)
			writeJSON(w, http.StatusServiceUnavailable, response{
				Status:   "degraded",
				Database: "unavailable",
			})
			return
		}

		writeJSON(w, http.StatusOK, response{
			Status:   "ok",
			Database: "ok",
		})
	}

	mux.HandleFunc("GET /healthz", healthHandler)
	mux.HandleFunc("GET /heatlhz", healthHandler)
	mux.HandleFunc("GET /readyz", readyHandler)
	mux.HandleFunc("GET /api/v1/health", readyHandler)
}

func registerVersion(mux *http.ServeMux) {
	mux.HandleFunc("GET /version", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, versionResponse{Version: version})
	})
}

func (s *Server) registerWebhook(mux *http.ServeMux) {
	handler := func(w http.ResponseWriter, r *http.Request) {
		s.handleTransactionWebhook(w, r)
	}

	mux.HandleFunc("POST /webhook/transactions", s.withWebhookAuth(handler))
	mux.HandleFunc("POST /webhooks/transactions", s.withWebhookAuth(handler))
}

func registerStubs(mux *http.ServeMux, endpoints []endpoint) {
	for _, endpoint := range endpoints {
		endpoint := endpoint
		pattern := endpoint.Method + " " + endpoint.Pattern
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			params := make(map[string]string)
			for _, name := range endpoint.Params {
				params[name] = r.PathValue(name)
			}
			if len(params) == 0 {
				params = nil
			}

			writeJSON(w, http.StatusNotImplemented, notImplementedResponse{
				Status:   "not_implemented",
				Method:   r.Method,
				Path:     r.URL.Path,
				Resource: endpoint.Resource,
				Action:   endpoint.Action,
				Params:   params,
			})
		})
	}
}

func endpoints() []endpoint {
	return nil
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
