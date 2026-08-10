package httpserver

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"zero-friction-erp/backend/internal/postgres"
)

func validBudgetPeriod(period string) bool {
	parsed, err := time.Parse("2006-01", period)
	return err == nil && parsed.Format("2006-01") == period
}

func (s *Server) registerBudgets(mux *http.ServeMux) {
	mux.HandleFunc("GET /budgets", s.handleGetBudget)
	mux.HandleFunc("PUT /budgets/allocations", s.handleUpsertAllocations)
	mux.HandleFunc("POST /budgets/shift", s.handleShiftFunds)
	mux.HandleFunc("POST /budgets/copy-previous", s.handleCopyPrevious)
}

func (s *Server) budgetRepo() *postgres.BudgetRepository {
	pool, ok := s.db.(*pgxpool.Pool)
	if !ok {
		panic("db is not a *pgxpool.Pool")
	}
	return postgres.NewBudgetRepository(pool)
}

func (s *Server) handleGetBudget(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if !validBudgetPeriod(period) {
		writeError(w, http.StatusBadRequest, "period must use YYYY-MM format")
		return
	}

	budget, err := s.budgetRepo().GetMonthlyBudget(r.Context(), userID(r), period)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	if budget == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "budget not found"})
		return
	}

	writeJSON(w, http.StatusOK, budget)
}

type upsertAllocationsPayload struct {
	Period      string                        `json:"period"`
	Allocations []postgres.CategoryAllocation `json:"allocations"`
}

func (s *Server) handleUpsertAllocations(w http.ResponseWriter, r *http.Request) {
	var p upsertAllocationsPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if !validBudgetPeriod(p.Period) {
		writeError(w, http.StatusBadRequest, "period must use YYYY-MM format")
		return
	}

	err := s.budgetRepo().UpsertAllocations(r.Context(), userID(r), p.Period, p.Allocations)
	if err != nil {
		s.writeDBError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

type shiftFundsPayload struct {
	Period           string  `json:"period"`
	SourceCategoryID string  `json:"source_category_id"`
	TargetCategoryID string  `json:"target_category_id"`
	Amount           float64 `json:"amount"`
	Notes            *string `json:"notes"`
}

func (s *Server) handleShiftFunds(w http.ResponseWriter, r *http.Request) {
	var p shiftFundsPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if !validBudgetPeriod(p.Period) || p.SourceCategoryID == "" || p.TargetCategoryID == "" || p.SourceCategoryID == p.TargetCategoryID || p.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "valid period, distinct source_category_id and target_category_id, and positive amount are required")
		return
	}

	err := s.budgetRepo().ShiftFundsAtomic(r.Context(), userID(r), p.Period, p.SourceCategoryID, p.TargetCategoryID, p.Amount, p.Notes)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

type copyPreviousPayload struct {
	TargetPeriod string `json:"target_period"`
}

func (s *Server) handleCopyPrevious(w http.ResponseWriter, r *http.Request) {
	var p copyPreviousPayload
	if !decodeBody(w, r, &p) {
		return
	}
	if !validBudgetPeriod(p.TargetPeriod) {
		writeError(w, http.StatusBadRequest, "target_period must use YYYY-MM format")
		return
	}

	err := s.budgetRepo().CopyPreviousMonthAllocations(r.Context(), userID(r), p.TargetPeriod)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}
