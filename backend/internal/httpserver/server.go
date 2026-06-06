package httpserver

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"time"
)

const maxWebhookBodyBytes = 1 << 20

type response struct {
	Status string `json:"status"`
}

type webhookResponse struct {
	Status     string    `json:"status"`
	ReceivedAt time.Time `json:"receivedAt"`
}

func NewRouter(logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, response{Status: "ok"})
	})

	mux.HandleFunc("POST /webhooks/transactions", func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxWebhookBodyBytes))
		if err != nil {
			writeError(w, http.StatusRequestEntityTooLarge, "request body is too large")
			return
		}
		if len(body) == 0 {
			writeError(w, http.StatusBadRequest, "request body is required")
			return
		}

		logger.Info("transaction webhook received", "bytes", len(body))
		writeJSON(w, http.StatusAccepted, webhookResponse{
			Status:     "accepted",
			ReceivedAt: time.Now().UTC(),
		})
	})

	return mux
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
