package handler

import (
	"net/http"

	"zero-friction-erp/backend/vercelapp"
)

// Handler is the Vercel Go function. The real work is in vercelapp, which may import
// internal packages; this file may not, because Vercel builds it as package handler/api.
func Handler(w http.ResponseWriter, r *http.Request) {
	vercelapp.Handler(w, r)
}
