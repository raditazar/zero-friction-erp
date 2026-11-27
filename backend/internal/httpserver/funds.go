package httpserver

import (
	"net/http"
	"strings"
)

// Sinking funds and saving goals are envelopes: money stays in the wallet and the fund's
// current_amount is the sum of its fund_entries (migration 017).

type fundEntryPayload struct {
	// "deposit" (default) or "withdraw"; amount is always positive.
	Type     *string  `json:"type"`
	Amount   *float64 `json:"amount"`
	WalletID *string  `json:"wallet_id"`
	Note     *string  `json:"note"`
	EntryAt  *string  `json:"entry_at"`
}

// fundKinds maps the URL segment to the fund table and its column on fund_entries.
var fundKinds = map[string]struct{ table, column string }{
	"sinking-funds": {"sinking_funds", "sinking_fund_id"},
	"saving-goals":  {"saving_goals", "saving_goal_id"},
}

func (s *Server) registerFunds(mux *http.ServeMux) {
	for segment := range fundKinds {
		mux.HandleFunc("GET /"+segment+"/{id}/entries", s.handleListFundEntries(segment))
		mux.HandleFunc("POST /"+segment+"/{id}/entries", s.handleCreateFundEntry(segment))
	}
	mux.HandleFunc("DELETE /fund-entries/{id}", s.handleDeleteFundEntry)
	mux.HandleFunc("GET /wallets/envelopes", s.handleWalletEnvelopes)
}

func (s *Server) handleListFundEntries(segment string) http.HandlerFunc {
	kind := fundKinds[segment]
	return func(w http.ResponseWriter, r *http.Request) {
		// The fund lookup turns an unknown or foreign fund into 404 instead of an empty list.
		s.writeQueryJSON(w, r, http.StatusOK, `
			select coalesce((
				select jsonb_agg(to_jsonb(e) order by e.entry_at desc, e.created_at desc)
				from fund_entries e
				where e.user_id = $1 and e.`+kind.column+` = f.id
			), '[]'::jsonb)
			from `+kind.table+` f
			where f.user_id = $1 and f.id = $2 and f.deleted_at is null
		`, userID(r), r.PathValue("id"))
	}
}

func (s *Server) handleCreateFundEntry(segment string) http.HandlerFunc {
	kind := fundKinds[segment]
	return func(w http.ResponseWriter, r *http.Request) {
		var p fundEntryPayload
		if !decodeBody(w, r, &p) {
			return
		}
		if p.Amount == nil || *p.Amount <= 0 {
			writeError(w, http.StatusBadRequest, "amount must be positive")
			return
		}
		entryType := "deposit"
		if p.Type != nil && strings.TrimSpace(*p.Type) != "" {
			entryType = strings.TrimSpace(*p.Type)
		}
		amount, source := *p.Amount, "manual"
		switch entryType {
		case "deposit":
		case "withdraw":
			amount, source = -amount, "withdrawal"
		default:
			writeError(w, http.StatusBadRequest, "type must be deposit or withdraw")
			return
		}
		// A withdrawal larger than the fund fails the fund's current_amount >= 0 check (400).
		s.writeQueryJSON(w, r, http.StatusCreated, `
			with entry as (
				insert into fund_entries (user_id, `+kind.column+`, wallet_id, amount, source, note, entry_at)
				select f.user_id, f.id, coalesce(nullif($3, '')::uuid, f.wallet_id), $4, $5::fund_entry_source, $6,
					coalesce(nullif($7, '')::timestamptz, now())
				from `+kind.table+` f
				where f.user_id = $1 and f.id = $2 and f.deleted_at is null
				returning *
			)
			select to_jsonb(entry) || jsonb_build_object('fund_current_amount', f.current_amount + entry.amount)
			from entry
			join `+kind.table+` f on f.id = entry.`+kind.column+`
		`, userID(r), r.PathValue("id"), stringValueOrEmpty(p.WalletID), amount, source, stringValue(p.Note), stringValueOrEmpty(p.EntryAt))
	}
}

// handleDeleteFundEntry removes a deposit or withdrawal. Allocation entries follow their
// income allocation, so they are undone by cancelling the allocation.
func (s *Server) handleDeleteFundEntry(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	var source string
	if err := s.db.QueryRow(r.Context(), `
		select source::text from fund_entries where user_id = $1 and id = $2
	`, userID(r), r.PathValue("id")).Scan(&source); err != nil {
		s.writeDBError(w, err)
		return
	}
	if source == "allocation" {
		writeError(w, http.StatusBadRequest, "cancel the income allocation to undo this entry")
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		delete from fund_entries
		where user_id = $1 and id = $2
		returning jsonb_build_object('id', id, 'deleted', true)
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleWalletEnvelopes(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(we)), '[]'::jsonb)
		from wallet_envelopes we
		where we.user_id = $1
	`, userID(r))
}
