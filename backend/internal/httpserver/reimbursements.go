package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// A reimbursement claim is an expense with is_reimbursement = true. Payments are income rows
// whose related_transaction_id points at the claim; the database derives the claim's status
// from them (migration 016).

type reimbursementLinkPayload struct {
	RelatedTransactionID *string `json:"related_transaction_id"`
}

type settleReimbursementPayload struct {
	// Links an income already in the ledger as a payment for this claim.
	RelatedTransactionID *string `json:"related_transaction_id"`
	// Records a new income into this wallet as a payment. Amount defaults to what is still
	// outstanding. Without wallet_id or related_transaction_id the claim is closed as paid
	// without recording any money (e.g. it was paid back outside the app).
	WalletID      *string  `json:"wallet_id"`
	Amount        *float64 `json:"amount"`
	TransactionAt *string  `json:"transaction_at"`
	Note          *string  `json:"note"`
}

var errNotAClaim = errors.New("transaction is not a reimbursement claim")

func (s *Server) registerReimbursements(mux *http.ServeMux) {
	mux.HandleFunc("GET /reimbursements", s.handleListReimbursements)
	mux.HandleFunc("POST /transactions/{id}/mark-reimbursement", s.handleMarkReimbursement)
	mux.HandleFunc("POST /transactions/{id}/link-reimbursement", s.handleLinkReimbursement)
	mux.HandleFunc("POST /transactions/{id}/settle-reimbursement", s.handleSettleReimbursement)
	mux.HandleFunc("POST /transactions/{id}/ignore-reimbursement", s.handleIgnoreReimbursement)
	mux.HandleFunc("POST /transactions/{id}/reopen-reimbursement", s.handleReopenReimbursement)
}

// claimJSONSQL renders one claim (alias c) with its amounts and payments.
const claimJSONSQL = `
	to_jsonb(c) || jsonb_build_object(
		'claimed', rc.claimed,
		'received', rc.received,
		'outstanding', rc.outstanding,
		'payments', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', p.id,
				'wallet_id', p.wallet_id,
				'amount', p.amount,
				'status', p.status,
				'transaction_at', p.transaction_at,
				'note', p.note
			) order by p.transaction_at)
			from transactions p
			where p.related_transaction_id = c.id and p.type = 'income' and p.deleted_at is null
		), '[]'::jsonb)
	)`

func (s *Server) handleListReimbursements(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(`+claimJSONSQL+` order by c.transaction_at desc), '[]'::jsonb)
		from transactions c
		join reimbursement_claims rc on rc.id = c.id
		where c.user_id = $1
	`, userID(r))
}

func (s *Server) writeClaim(w http.ResponseWriter, r *http.Request, q rowQuerier, claimID string) {
	var payload json.RawMessage
	err := q.QueryRow(r.Context(), `
		select `+claimJSONSQL+`
		from transactions c
		join reimbursement_claims rc on rc.id = c.id
		where c.user_id = $1 and c.id = $2
	`, userID(r), claimID).Scan(&payload)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	writeRawJSON(w, http.StatusOK, payload)
}

// lookupClaim reports the transaction's type, whether it is a claim and its status, or
// pgx.ErrNoRows when the user has no such live transaction.
func lookupClaim(ctx context.Context, q rowQuerier, userID, id string) (txType string, isClaim bool, status string, err error) {
	err = q.QueryRow(ctx, `
		select type::text, is_reimbursement, reimbursement_status::text
		from transactions
		where user_id = $1 and id = $2 and deleted_at is null
	`, userID, id).Scan(&txType, &isClaim, &status)
	return
}

func (s *Server) requireClaim(w http.ResponseWriter, r *http.Request, id string) (status string, ok bool) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return "", false
	}
	_, isClaim, status, err := lookupClaim(r.Context(), s.db, userID(r), id)
	if err != nil {
		s.writeDBError(w, err)
		return "", false
	}
	if !isClaim {
		writeError(w, http.StatusBadRequest, errNotAClaim.Error())
		return "", false
	}
	return status, true
}

func (s *Server) handleMarkReimbursement(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	id := r.PathValue("id")
	txType, isClaim, _, err := lookupClaim(r.Context(), s.db, userID(r), id)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	if txType != "expense" {
		writeError(w, http.StatusBadRequest, "only an expense can be a reimbursement claim")
		return
	}
	if !isClaim {
		var marked string
		if err := s.db.QueryRow(r.Context(), `
			update transactions
			set is_reimbursement = true, reimbursement_status = 'receivable'
			where user_id = $1 and id = $2 and deleted_at is null
			returning id::text
		`, userID(r), id).Scan(&marked); err != nil {
			s.writeDBError(w, err)
			return
		}
	}
	s.writeClaim(w, r, s.db, id)
}

// handleLinkReimbursement records an existing income ({related_transaction_id}) as a payment
// for the claim in the path.
func (s *Server) handleLinkReimbursement(w http.ResponseWriter, r *http.Request) {
	var payload reimbursementLinkPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	if missing(payload.RelatedTransactionID) {
		writeError(w, http.StatusBadRequest, "related_transaction_id is required")
		return
	}
	id := r.PathValue("id")
	if _, ok := s.requireClaim(w, r, id); !ok {
		return
	}
	s.linkPayment(w, r, id, strings.TrimSpace(*payload.RelatedTransactionID))
}

func (s *Server) linkPayment(w http.ResponseWriter, r *http.Request, claimID, paymentID string) {
	var linked string
	err := s.db.QueryRow(r.Context(), `
		update transactions
		set related_transaction_id = $3::uuid
		where user_id = $1 and id = $2::uuid and deleted_at is null and type = 'income'
		returning id::text
	`, userID(r), paymentID, claimID).Scan(&linked)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusBadRequest, "related_transaction_id must be one of your income transactions")
		return
	}
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	s.writeClaim(w, r, s.db, claimID)
}

func (s *Server) handleSettleReimbursement(w http.ResponseWriter, r *http.Request) {
	var payload settleReimbursementPayload
	if r.ContentLength != 0 && !decodeBody(w, r, &payload) {
		return
	}
	id := r.PathValue("id")
	status, ok := s.requireClaim(w, r, id)
	if !ok {
		return
	}
	if status == "ignored" {
		writeError(w, http.StatusBadRequest, "claim is ignored; reopen it first")
		return
	}

	if !missing(payload.RelatedTransactionID) {
		s.linkPayment(w, r, id, strings.TrimSpace(*payload.RelatedTransactionID))
		return
	}

	if missing(payload.WalletID) {
		var closed string
		if err := s.db.QueryRow(r.Context(), `
			update transactions
			set reimbursement_settled_at = coalesce(reimbursement_settled_at, now())
			where user_id = $1 and id = $2 and deleted_at is null
			returning id::text
		`, userID(r), id).Scan(&closed); err != nil {
			s.writeDBError(w, err)
			return
		}
		s.writeClaim(w, r, s.db, id)
		return
	}

	if payload.Amount != nil && *payload.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "amount must be positive")
		return
	}
	transactionAt := time.Now().UTC().Format(time.RFC3339)
	if payload.TransactionAt != nil && strings.TrimSpace(*payload.TransactionAt) != "" {
		transactionAt = *payload.TransactionAt
	}

	if payload.Amount == nil {
		var outstanding float64
		if err := s.db.QueryRow(r.Context(), `select outstanding::float8 from reimbursement_claims where user_id = $1 and id = $2`, userID(r), id).Scan(&outstanding); err != nil {
			s.writeDBError(w, err)
			return
		}
		if outstanding <= 0 {
			writeError(w, http.StatusBadRequest, "nothing is outstanding on this claim; send an amount")
			return
		}
		payload.Amount = &outstanding
	}

	// One statement: the trigger from migration 016 updates the claim's status with it.
	var paymentID string
	err := s.db.QueryRow(r.Context(), `
		insert into transactions (user_id, wallet_id, type, status, transaction_at, merchant, amount, category_id, related_transaction_id, note, input_source, input_mode)
		select c.user_id, $3::uuid, 'income', 'approved', $4::timestamptz,
			'Reimburse: ' || coalesce(nullif(c.merchant, ''), 'klaim'),
			$5,
			(select k.id from categories k
			 where k.user_id = c.user_id and k.type = 'income' and lower(k.name) = 'reimbursement' and k.deleted_at is null
			 order by k.created_at limit 1),
			c.id, $6, 'manual', 'manual'
		from transactions c
		where c.user_id = $1 and c.id = $2 and c.deleted_at is null
		returning id::text
	`, userID(r), id, stringValue(payload.WalletID), transactionAt, *payload.Amount, stringValue(payload.Note)).Scan(&paymentID)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	s.writeClaim(w, r, s.db, id)
}

func (s *Server) handleIgnoreReimbursement(w http.ResponseWriter, r *http.Request) {
	s.setClaimState(w, r, `reimbursement_status = 'ignored'`)
}

// handleReopenReimbursement undoes ignore and manual settle; the status is then recomputed
// from the payments.
func (s *Server) handleReopenReimbursement(w http.ResponseWriter, r *http.Request) {
	s.setClaimState(w, r, `reimbursement_status = 'receivable', reimbursement_settled_at = null`)
}

func (s *Server) setClaimState(w http.ResponseWriter, r *http.Request, assignments string) {
	id := r.PathValue("id")
	if _, ok := s.requireClaim(w, r, id); !ok {
		return
	}
	var updated string
	if err := s.db.QueryRow(r.Context(), `
		update transactions set `+assignments+`
		where user_id = $1 and id = $2 and deleted_at is null and is_reimbursement = true
		returning id::text
	`, userID(r), id).Scan(&updated); err != nil {
		s.writeDBError(w, err)
		return
	}
	s.writeClaim(w, r, s.db, id)
}
