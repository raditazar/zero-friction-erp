package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Matching a wallet to its real balance (migration 018). The user types what the bank or the
// cash drawer really holds; the server works out the difference against the app's balance at
// that moment and records it as an adjustment (left out of reports) or as an ordinary income
// or expense (counted). Every check is kept in wallet_reconciliations, also when it matched.

type reconcilePayload struct {
	ActualBalance *float64 `json:"actual_balance"`
	// RFC 3339; defaults to now. The balance is compared as it stood at this moment.
	AsOf *string `json:"as_of"`
	// "adjustment" (default) or "transaction".
	Resolution *string `json:"resolution"`
	CategoryID *string `json:"category_id"`
	Note       *string `json:"note"`
}

// asOfSlack lets a client clock that runs a little ahead still count as "now".
const asOfSlack = 5 * time.Minute

func (s *Server) registerReconcile(mux *http.ServeMux) {
	mux.HandleFunc("GET /wallets/{id}/reconcile-preview", s.handleReconcilePreview)
	mux.HandleFunc("POST /wallets/{id}/reconcile", s.handleReconcile)
}

func parseAsOf(raw string, now time.Time) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return now, nil
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, errors.New("as_of must be an RFC 3339 timestamp")
	}
	if t.After(now.Add(asOfSlack)) {
		return time.Time{}, errors.New("as_of cannot be in the future")
	}
	return t, nil
}

func (s *Server) handleReconcilePreview(w http.ResponseWriter, r *http.Request) {
	asOf, err := parseAsOf(r.URL.Query().Get("as_of"), time.Now())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		select jsonb_build_object(
			'wallet_id', w.id,
			'as_of', $3::timestamptz,
			'app_balance', wallet_balance_at(w.id, $3::timestamptz),
			'pending_count', (
				select count(*) from transactions t
				where t.user_id = w.user_id and t.deleted_at is null
					and t.status in ('pending', 'needs_review')
					and (t.wallet_id = w.id or t.destination_wallet_id = w.id)
			),
			'last_reconciled', (
				select jsonb_build_object(
					'as_of', rc.as_of, 'actual_balance', rc.actual_balance,
					'difference', rc.difference, 'resolution', rc.resolution, 'created_at', rc.created_at
				)
				from wallet_reconciliations rc
				where rc.wallet_id = w.id
				order by rc.as_of desc, rc.created_at desc
				limit 1
			)
		)
		from wallets w
		where w.user_id = $1 and w.id = $2 and w.deleted_at is null
	`, userID(r), r.PathValue("id"), asOf)
}

func (s *Server) handleReconcile(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	var p reconcilePayload
	if !decodeBody(w, r, &p) {
		return
	}
	if p.ActualBalance == nil || math.IsNaN(*p.ActualBalance) || math.IsInf(*p.ActualBalance, 0) {
		writeError(w, http.StatusBadRequest, "actual_balance is required")
		return
	}
	asOf, err := parseAsOf(stringValueOrEmpty(p.AsOf), time.Now())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	resolution := "adjustment"
	if p.Resolution != nil && strings.TrimSpace(*p.Resolution) != "" {
		resolution = strings.TrimSpace(*p.Resolution)
	}
	if resolution != "adjustment" && resolution != "transaction" {
		writeError(w, http.StatusBadRequest, "resolution must be adjustment or transaction")
		return
	}

	walletID := r.PathValue("id")
	var payload json.RawMessage
	err = s.withTx(r.Context(), func(q rowQuerier) error {
		if err := lockWallet(r.Context(), q, walletID); err != nil {
			return err
		}
		var appBalance float64
		if err := q.QueryRow(r.Context(), `
			select wallet_balance_at(w.id, $3)::float8
			from wallets w
			where w.user_id = $1 and w.id = $2 and w.deleted_at is null
		`, userID(r), walletID, asOf).Scan(&appBalance); err != nil {
			return err
		}
		// Money is stored with two decimals; compare in cents so float noise is not a difference.
		difference := math.Round((*p.ActualBalance-appBalance)*100) / 100

		var transactionID *string
		recorded := "matched"
		if difference != 0 {
			recorded = resolution
			txType, amount := "adjustment", difference
			if resolution == "transaction" {
				txType, amount = "income", difference
				if difference < 0 {
					txType, amount = "expense", -difference
				}
			}
			var id string
			if err := q.QueryRow(r.Context(), `
				insert into transactions (user_id, wallet_id, type, status, transaction_at, merchant, amount, category_id, note, input_source, input_mode)
				values ($1, $2::uuid, $3::transaction_type, 'approved', $4, 'Penyesuaian saldo', $5,
					coalesce(nullif($6, '')::uuid, case when $3 = 'adjustment' then (
						select c.id from categories c
						where c.user_id = $1 and c.type = 'adjustment' and c.deleted_at is null
						order by c.created_at limit 1
					) end),
					coalesce(nullif($7, ''), 'Selisih saat mencocokkan saldo'), 'manual', 'manual')
				returning id::text
			`, userID(r), walletID, txType, asOf, amount, stringValueOrEmpty(p.CategoryID), stringValueOrEmpty(p.Note)).Scan(&id); err != nil {
				return err
			}
			transactionID = &id
		}

		return q.QueryRow(r.Context(), `
			with rec as (
				insert into wallet_reconciliations (user_id, wallet_id, as_of, actual_balance, app_balance, difference, resolution, transaction_id, note)
				values ($1, $2::uuid, $3, $4, $5, $4::numeric - $5::numeric, $6::reconciliation_resolution, $7::uuid, nullif($8, ''))
				returning *
			)
			select jsonb_build_object(
				'reconciliation', to_jsonb(rec),
				'transaction', (select to_jsonb(t) from transactions t where t.id = rec.transaction_id),
				-- The transaction was inserted by an earlier statement, so this one already sees it.
				'balance', (select wb.curr_balance from wallet_balances wb where wb.id = rec.wallet_id)
			)
			from rec
		`, userID(r), walletID, asOf, *p.ActualBalance, appBalance, recorded, transactionID, stringValueOrEmpty(p.Note)).Scan(&payload)
	})
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	writeRawJSON(w, http.StatusOK, payload)
}

// lockWallet serialises reconciliations of one wallet until the DB transaction ends, so two
// taps on "Simpan" cannot both book the same difference. Outside a real transaction it does
// nothing.
func lockWallet(ctx context.Context, q rowQuerier, walletID string) error {
	if _, ok := q.(pgx.Tx); !ok {
		return nil
	}
	var locked bool
	return q.QueryRow(ctx, `select true from (select pg_advisory_xact_lock(hashtextextended('wallet:' || $1, 0))) l`, walletID).Scan(&locked)
}
