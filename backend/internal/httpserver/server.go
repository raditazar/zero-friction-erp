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
const demoUserID = "00000000-0000-0000-0000-000000000001"

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

	registerReadiness(mux, logger, db)
	registerVersion(mux)
	server.registerResources(mux)
	server.registerWebhook(mux)
	registerStubs(mux, endpoints())

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

	mux.HandleFunc("POST /webhook/transactions", handler)
	mux.HandleFunc("POST /webhooks/transactions", handler)
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
	return []endpoint{
		{Method: "GET", Pattern: "/saving-goals", Resource: "saving_goals", Action: "list"},
		{Method: "POST", Pattern: "/saving-goals", Resource: "saving_goals", Action: "create"},
		{Method: "GET", Pattern: "/saving-goals/{id}", Resource: "saving_goals", Action: "read", Params: []string{"id"}},
		{Method: "PATCH", Pattern: "/saving-goals/{id}", Resource: "saving_goals", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/saving-goals/{id}", Resource: "saving_goals", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/sinking-funds", Resource: "sinking_funds", Action: "list"},
		{Method: "POST", Pattern: "/sinking-funds", Resource: "sinking_funds", Action: "create"},
		{Method: "GET", Pattern: "/sinking-funds/{id}", Resource: "sinking_funds", Action: "read", Params: []string{"id"}},
		{Method: "PATCH", Pattern: "/sinking-funds/{id}", Resource: "sinking_funds", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/sinking-funds/{id}", Resource: "sinking_funds", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/budget-allocations", Resource: "budget_allocations", Action: "list"},
		{Method: "POST", Pattern: "/budget-allocations", Resource: "budget_allocations", Action: "create"},
		{Method: "PATCH", Pattern: "/budget-allocations/{id}", Resource: "budget_allocations", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/budget-allocations/{id}", Resource: "budget_allocations", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/income-routing-rules", Resource: "income_routing_rules", Action: "list"},
		{Method: "POST", Pattern: "/income-routing-rules", Resource: "income_routing_rules", Action: "create"},
		{Method: "GET", Pattern: "/income-routing-rules/{id}", Resource: "income_routing_rules", Action: "read", Params: []string{"id"}},
		{Method: "PATCH", Pattern: "/income-routing-rules/{id}", Resource: "income_routing_rules", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/income-routing-rules/{id}", Resource: "income_routing_rules", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/income-allocations", Resource: "income_allocations", Action: "list"},
		{Method: "POST", Pattern: "/income-allocations", Resource: "income_allocations", Action: "create"},
		{Method: "PATCH", Pattern: "/income-allocations/{id}", Resource: "income_allocations", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/income-allocations/{id}", Resource: "income_allocations", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/budgets", Resource: "budgets", Action: "list"},
		{Method: "POST", Pattern: "/budgets", Resource: "budgets", Action: "create"},
		{Method: "GET", Pattern: "/budgets/{id}", Resource: "budgets", Action: "read", Params: []string{"id"}},
		{Method: "PATCH", Pattern: "/budgets/{id}", Resource: "budgets", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/budgets/{id}", Resource: "budgets", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/budget-periods", Resource: "budget_periods", Action: "list"},
		{Method: "POST", Pattern: "/budget-periods", Resource: "budget_periods", Action: "create"},
		{Method: "GET", Pattern: "/budget-periods/{id}", Resource: "budget_periods", Action: "read", Params: []string{"id"}},
		{Method: "PATCH", Pattern: "/budget-periods/{id}", Resource: "budget_periods", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/budget-periods/{id}", Resource: "budget_periods", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/budget-categories", Resource: "budget_categories", Action: "list"},
		{Method: "POST", Pattern: "/budget-categories", Resource: "budget_categories", Action: "create"},
		{Method: "PATCH", Pattern: "/budget-categories/{id}", Resource: "budget_categories", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/budget-categories/{id}", Resource: "budget_categories", Action: "delete", Params: []string{"id"}},

		{Method: "GET", Pattern: "/api-keys", Resource: "api_keys", Action: "list"},
		{Method: "POST", Pattern: "/api-keys", Resource: "api_keys", Action: "create"},
		{Method: "DELETE", Pattern: "/api-keys/{id}", Resource: "api_keys", Action: "revoke", Params: []string{"id"}},

		{Method: "GET", Pattern: "/webhook-tokens", Resource: "webhook_tokens", Action: "list"},
		{Method: "POST", Pattern: "/webhook-tokens", Resource: "webhook_tokens", Action: "create"},
		{Method: "DELETE", Pattern: "/webhook-tokens/{id}", Resource: "webhook_tokens", Action: "revoke", Params: []string{"id"}},

		{Method: "POST", Pattern: "/ai/extract-transaction", Resource: "ai", Action: "extract_transaction"},
		{Method: "POST", Pattern: "/ai/categorize-transaction", Resource: "ai", Action: "categorize_transaction"},

		{Method: "GET", Pattern: "/recurring-rules", Resource: "recurring_rules", Action: "list"},
		{Method: "POST", Pattern: "/recurring-rules", Resource: "recurring_rules", Action: "create"},
		{Method: "GET", Pattern: "/recurring-rules/{id}", Resource: "recurring_rules", Action: "read", Params: []string{"id"}},
		{Method: "PATCH", Pattern: "/recurring-rules/{id}", Resource: "recurring_rules", Action: "update", Params: []string{"id"}},
		{Method: "DELETE", Pattern: "/recurring-rules/{id}", Resource: "recurring_rules", Action: "delete", Params: []string{"id"}},
		{Method: "POST", Pattern: "/cron/run-recurring", Resource: "cron", Action: "run_recurring"},

		{Method: "GET", Pattern: "/analytics/summary", Resource: "analytics", Action: "summary"},
		{Method: "GET", Pattern: "/analytics/cashflow", Resource: "analytics", Action: "cashflow"},
		{Method: "GET", Pattern: "/analytics/spending-by-category", Resource: "analytics", Action: "spending_by_category"},
		{Method: "GET", Pattern: "/analytics/spending-by-tags", Resource: "analytics", Action: "spending_by_tags"},
		{Method: "GET", Pattern: "/analytics/wallet-balances", Resource: "analytics", Action: "wallet_balances"},
		{Method: "GET", Pattern: "/analytics/reimbursements", Resource: "analytics", Action: "reimbursements"},
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
