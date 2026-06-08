package httpserver

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type walletPayload struct {
	Name          *string  `json:"name"`
	Category      *string  `json:"category"`
	Provider      *string  `json:"provider"`
	AccountNumber *string  `json:"account_number"`
	AccountHolder *string  `json:"account_holder"`
	Currency      *string  `json:"currency"`
	InitBalance   *float64 `json:"init_balance"`
	IsActive      *bool    `json:"is_active"`
}

type categoryPayload struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	ParentID *string `json:"parent_id"`
}

type tagPayload struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

type profilePayload struct {
	FullName    *string `json:"full_name"`
	PhoneNumber *string `json:"phone_number"`
	Avatar      *string `json:"avatar"`
}

type transactionPayload struct {
	WalletID             *string  `json:"wallet_id"`
	DestinationWalletID  *string  `json:"destination_wallet_id"`
	Type                 *string  `json:"type"`
	Status               *string  `json:"status"`
	TransactionAt        *string  `json:"transaction_at"`
	Merchant             *string  `json:"merchant"`
	Amount               *float64 `json:"amount"`
	CategoryID           *string  `json:"category_id"`
	IsReimbursement      *bool    `json:"is_reimbursement"`
	ReimbursementStatus  *string  `json:"reimbursement_status"`
	RelatedTransactionID *string  `json:"related_transaction_id"`
	Note                 *string  `json:"note"`
	InputSource          *string  `json:"input_source"`
	InputMode            *string  `json:"input_mode"`
	RawInput             *string  `json:"raw_input"`
	AIConfidence         *float64 `json:"ai_confidence"`
}

type bulkUpdatePayload struct {
	IDs        []string `json:"ids"`
	Status     *string  `json:"status"`
	CategoryID *string  `json:"category_id"`
}

type reimbursementLinkPayload struct {
	RelatedTransactionID *string `json:"related_transaction_id"`
}

func (s *Server) registerResources(mux *http.ServeMux) {
	mux.HandleFunc("GET /me", s.handleGetMe)
	mux.HandleFunc("PATCH /me", s.handlePatchMe)
	mux.HandleFunc("POST /starter-workspace", s.handleStarterWorkspace)

	mux.HandleFunc("GET /wallets", s.handleListWallets)
	mux.HandleFunc("POST /wallets", s.handleCreateWallet)
	mux.HandleFunc("GET /wallets/{id}", s.handleGetWallet)
	mux.HandleFunc("PATCH /wallets/{id}", s.handlePatchWallet)
	mux.HandleFunc("DELETE /wallets/{id}", s.handleDeleteWallet)
	mux.HandleFunc("GET /wallets/{id}/balance", s.handleGetWalletBalance)
	mux.HandleFunc("GET /wallets/{id}/transactions", s.handleGetWalletTransactions)

	mux.HandleFunc("GET /categories", s.handleListCategories)
	mux.HandleFunc("POST /categories", s.handleCreateCategory)
	mux.HandleFunc("PATCH /categories/{id}", s.handlePatchCategory)
	mux.HandleFunc("DELETE /categories/{id}", s.handleDeleteCategory)

	mux.HandleFunc("GET /tags", s.handleListTags)
	mux.HandleFunc("POST /tags", s.handleCreateTag)
	mux.HandleFunc("PATCH /tags/{id}", s.handlePatchTag)
	mux.HandleFunc("DELETE /tags/{id}", s.handleDeleteTag)

	mux.HandleFunc("GET /transactions", s.handleListTransactions)
	mux.HandleFunc("POST /transactions", s.handleCreateTransaction)
	mux.HandleFunc("GET /transactions/{id}", s.handleGetTransaction)
	mux.HandleFunc("PATCH /transactions/{id}", s.handlePatchTransaction)
	mux.HandleFunc("DELETE /transactions/{id}", s.handleDeleteTransaction)
	mux.HandleFunc("POST /transactions/{id}/approve", s.handleApproveTransaction)
	mux.HandleFunc("POST /transactions/{id}/reject", s.handleRejectTransaction)
	mux.HandleFunc("POST /transactions/bulk-update", s.handleBulkUpdateTransactions)
	mux.HandleFunc("POST /transactions/transfer", s.handleCreateTransfer)

	mux.HandleFunc("GET /inbox/transactions", s.handleInboxTransactions)
	mux.HandleFunc("POST /inbox/transactions/{id}/approve", s.handleApproveTransaction)
	mux.HandleFunc("POST /inbox/transactions/{id}/reject", s.handleRejectTransaction)
	mux.HandleFunc("PATCH /inbox/transactions/{id}", s.handlePatchTransaction)

	mux.HandleFunc("GET /webhook-events", s.handleListWebhookEvents)
	mux.HandleFunc("GET /webhook-events/{id}", s.handleGetWebhookEvent)
	mux.HandleFunc("POST /webhook-events/{id}/retry", s.handleRetryWebhookEvent)

	mux.HandleFunc("GET /dead-letter-queue", s.handleListDeadLetters)
	mux.HandleFunc("GET /dead-letter-queue/{id}", s.handleGetDeadLetter)
	mux.HandleFunc("POST /dead-letter-queue/{id}/retry", s.handleRetryDeadLetter)
	mux.HandleFunc("POST /dead-letter-queue/{id}/resolve", s.handleResolveDeadLetter)
	mux.HandleFunc("POST /dead-letter-queue/{id}/ignore", s.handleIgnoreDeadLetter)

	mux.HandleFunc("GET /reimbursements", s.handleListReimbursements)
	mux.HandleFunc("POST /transactions/{id}/mark-reimbursement", s.handleMarkReimbursement)
	mux.HandleFunc("POST /transactions/{id}/link-reimbursement", s.handleLinkReimbursement)
	mux.HandleFunc("POST /transactions/{id}/settle-reimbursement", s.handleSettleReimbursement)
}

func (s *Server) handleStarterWorkspace(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}
	payload, err := s.ensureStarterWorkspace(r, userID(r))
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	writeRawJSON(w, http.StatusOK, payload)
}

func (s *Server) ensureStarterWorkspace(r *http.Request, requestUserID string) (json.RawMessage, error) {
	var payload json.RawMessage
	err := s.db.QueryRow(r.Context(), `
		with target_user as (
			select $1::uuid as user_id
		),
		inserted_wallets as (
			insert into wallets (user_id, name, category, provider, currency, init_balance)
			select target_user.user_id, starter.name, starter.category::wallet_category, starter.provider, 'IDR', 0
			from target_user
			cross join (values
				('Cash', 'cash', 'Cash'),
				('Main Bank', 'bank', 'Bank'),
				('E-Wallet', 'wallet', 'E-Wallet')
			) as starter(name, category, provider)
			where not exists (
				select 1 from wallets w where w.user_id = target_user.user_id and w.deleted_at is null
			)
			returning id
		),
		inserted_categories as (
			insert into categories (user_id, name, type)
			select target_user.user_id, starter.name, starter.type::category_type
			from target_user
			cross join (values
				('Food', 'expense'),
				('Transport', 'expense'),
				('Bills', 'expense'),
				('Subscription', 'expense'),
				('Health', 'expense'),
				('Shopping', 'expense'),
				('Other Expense', 'expense'),
				('Salary', 'income'),
				('Reimbursement', 'income'),
				('Freelance', 'income'),
				('Other Income', 'income'),
				('Wallet Transfer', 'transfer')
			) as starter(name, type)
			where not exists (
				select 1 from categories c where c.user_id = target_user.user_id and c.deleted_at is null
			)
			returning id
		),
		inserted_tags as (
			insert into tags (user_id, name, color)
			select target_user.user_id, starter.name, starter.color
			from target_user
			cross join (values
				('personal', '#2563eb'),
				('work', '#4f46e5'),
				('project', '#7c3aed'),
				('reimbursement', '#ea580c')
			) as starter(name, color)
			where not exists (
				select 1 from tags t where t.user_id = target_user.user_id and t.deleted_at is null
			)
			returning id
		)
		select jsonb_build_object(
			'status', 'ready',
			'inserted_wallets', (select count(*) from inserted_wallets),
			'inserted_categories', (select count(*) from inserted_categories),
			'inserted_tags', (select count(*) from inserted_tags)
		)
	`, requestUserID).Scan(&payload)
	return payload, err
}

func (s *Server) handleGetMe(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select jsonb_build_object(
			'id', u.id,
			'email', u.email,
			'created_at', u.created_at,
			'profile', to_jsonb(p)
		)
		from users u
		left join profiles p on p.id = u.id
		where u.id = $1
	`, userID(r))
}

func (s *Server) handlePatchMe(w http.ResponseWriter, r *http.Request) {
	var payload profilePayload
	if !decodeBody(w, r, &payload) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update profiles
		set
			full_name = coalesce($2, full_name),
			phone_number = coalesce($3, phone_number),
			avatar = coalesce($4, avatar)
		where id = $1
		returning to_jsonb(profiles.*)
	`, userID(r), stringValue(payload.FullName), stringValue(payload.PhoneNumber), stringValue(payload.Avatar))
}

func (s *Server) handleListWallets(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at), '[]'::jsonb)
		from wallets w
		where w.user_id = $1 and w.deleted_at is null
	`, userID(r))
}

func (s *Server) handleCreateWallet(w http.ResponseWriter, r *http.Request) {
	var payload walletPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	if missing(payload.Name) || missing(payload.Category) {
		writeError(w, http.StatusBadRequest, "name and category are required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into wallets (user_id, name, category, provider, account_number, account_holder, currency, init_balance, is_active)
		values ($1, $2, $3::wallet_category, $4, $5, $6, coalesce($7, 'IDR'), coalesce($8, 0), coalesce($9, true))
		returning to_jsonb(wallets.*)
	`, userID(r), stringValue(payload.Name), stringValue(payload.Category), stringValue(payload.Provider), stringValue(payload.AccountNumber), stringValue(payload.AccountHolder), stringValue(payload.Currency), floatValue(payload.InitBalance), boolValue(payload.IsActive))
}

func (s *Server) handleGetWallet(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select to_jsonb(w)
		from wallets w
		where w.user_id = $1 and w.id = $2 and w.deleted_at is null
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handlePatchWallet(w http.ResponseWriter, r *http.Request) {
	var payload walletPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update wallets
		set
			name = coalesce($3, name),
			category = coalesce($4::wallet_category, category),
			provider = coalesce($5, provider),
			account_number = coalesce($6, account_number),
			account_holder = coalesce($7, account_holder),
			currency = coalesce($8, currency),
			init_balance = coalesce($9, init_balance),
			is_active = coalesce($10, is_active)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(wallets.*)
	`, userID(r), r.PathValue("id"), stringValue(payload.Name), stringValue(payload.Category), stringValue(payload.Provider), stringValue(payload.AccountNumber), stringValue(payload.AccountHolder), stringValue(payload.Currency), floatValue(payload.InitBalance), boolValue(payload.IsActive))
}

func (s *Server) handleDeleteWallet(w http.ResponseWriter, r *http.Request) {
	s.softDelete(w, r, "wallets", r.PathValue("id"))
}

func (s *Server) handleGetWalletBalance(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select to_jsonb(wb)
		from wallet_balances wb
		where wb.user_id = $1 and wb.wallet_id = $2
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleGetWalletTransactions(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(t) order by t.transaction_at desc), '[]'::jsonb)
		from transactions t
		where t.user_id = $1
			and t.deleted_at is null
			and (t.wallet_id = $2 or t.destination_wallet_id = $2)
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleListCategories(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]'::jsonb)
		from categories c
		where c.user_id = $1 and c.deleted_at is null
	`, userID(r))
}

func (s *Server) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	var payload categoryPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	if missing(payload.Name) || missing(payload.Type) {
		writeError(w, http.StatusBadRequest, "name and type are required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into categories (user_id, name, type, parent_id)
		values ($1, $2, $3::category_type, nullif($4, '')::uuid)
		returning to_jsonb(categories.*)
	`, userID(r), stringValue(payload.Name), stringValue(payload.Type), stringValueOrEmpty(payload.ParentID))
}

func (s *Server) handlePatchCategory(w http.ResponseWriter, r *http.Request) {
	var payload categoryPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update categories
		set
			name = coalesce($3, name),
			type = coalesce($4::category_type, type),
			parent_id = coalesce(nullif($5, '')::uuid, parent_id)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(categories.*)
	`, userID(r), r.PathValue("id"), stringValue(payload.Name), stringValue(payload.Type), stringValueOrEmpty(payload.ParentID))
}

func (s *Server) handleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	s.softDelete(w, r, "categories", r.PathValue("id"))
}

func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb)
		from tags t
		where t.user_id = $1 and t.deleted_at is null
	`, userID(r))
}

func (s *Server) handleCreateTag(w http.ResponseWriter, r *http.Request) {
	var payload tagPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	if missing(payload.Name) {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusCreated, `
		insert into tags (user_id, name, color)
		values ($1, $2, $3)
		returning to_jsonb(tags.*)
	`, userID(r), stringValue(payload.Name), stringValue(payload.Color))
}

func (s *Server) handlePatchTag(w http.ResponseWriter, r *http.Request) {
	var payload tagPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update tags
		set name = coalesce($3, name), color = coalesce($4, color)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(tags.*)
	`, userID(r), r.PathValue("id"), stringValue(payload.Name), stringValue(payload.Color))
}

func (s *Server) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	s.softDelete(w, r, "tags", r.PathValue("id"))
}

func (s *Server) handleListTransactions(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(t) order by t.transaction_at desc), '[]'::jsonb)
		from transactions t
		where t.user_id = $1 and t.deleted_at is null
	`, userID(r))
}

func (s *Server) handleCreateTransaction(w http.ResponseWriter, r *http.Request) {
	var payload transactionPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	if missing(payload.WalletID) || missing(payload.Type) || payload.Amount == nil {
		writeError(w, http.StatusBadRequest, "wallet_id, type, and amount are required")
		return
	}
	normalizeTransactionPayload(&payload)
	transactionAt := time.Now().UTC().Format(time.RFC3339)
	if payload.TransactionAt != nil && strings.TrimSpace(*payload.TransactionAt) != "" {
		transactionAt = *payload.TransactionAt
	}
	s.writeQueryJSON(w, r, http.StatusCreated, createTransactionSQL(), transactionArgs(userID(r), payload, transactionAt)...)
}

func (s *Server) handleCreateTransfer(w http.ResponseWriter, r *http.Request) {
	var payload transactionPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	transferType := "transfer"
	payload.Type = &transferType
	if missing(payload.WalletID) || missing(payload.DestinationWalletID) || payload.Amount == nil {
		writeError(w, http.StatusBadRequest, "wallet_id, destination_wallet_id, and amount are required")
		return
	}
	normalizeTransactionPayload(&payload)
	transactionAt := time.Now().UTC().Format(time.RFC3339)
	if payload.TransactionAt != nil && strings.TrimSpace(*payload.TransactionAt) != "" {
		transactionAt = *payload.TransactionAt
	}
	s.writeQueryJSON(w, r, http.StatusCreated, createTransactionSQL(), transactionArgs(userID(r), payload, transactionAt)...)
}

func (s *Server) handleGetTransaction(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select to_jsonb(t)
		from transactions t
		where t.user_id = $1 and t.id = $2 and t.deleted_at is null
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handlePatchTransaction(w http.ResponseWriter, r *http.Request) {
	var payload transactionPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update transactions
		set
			wallet_id = coalesce(nullif($3, '')::uuid, wallet_id),
			destination_wallet_id = coalesce(nullif($4, '')::uuid, destination_wallet_id),
			type = coalesce($5::transaction_type, type),
			status = coalesce($6::transaction_status, status),
			transaction_at = coalesce(nullif($7, '')::timestamptz, transaction_at),
			merchant = coalesce($8, merchant),
			amount = coalesce($9, amount),
			category_id = coalesce(nullif($10, '')::uuid, category_id),
			is_reimbursement = coalesce($11, is_reimbursement),
			reimbursement_status = coalesce($12::reimbursement_status, reimbursement_status),
			related_transaction_id = coalesce(nullif($13, '')::uuid, related_transaction_id),
			note = coalesce($14, note),
			input_source = coalesce($15::input_source, input_source),
			input_mode = coalesce($16::input_mode, input_mode),
			raw_input = coalesce($17, raw_input),
			ai_confidence = coalesce($18, ai_confidence)
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(transactions.*)
	`, userID(r), r.PathValue("id"), stringValueOrEmpty(payload.WalletID), stringValueOrEmpty(payload.DestinationWalletID), stringValue(payload.Type), stringValue(payload.Status), stringValueOrEmpty(payload.TransactionAt), stringValue(payload.Merchant), floatValue(payload.Amount), stringValueOrEmpty(payload.CategoryID), boolValue(payload.IsReimbursement), stringValue(payload.ReimbursementStatus), stringValueOrEmpty(payload.RelatedTransactionID), stringValue(payload.Note), stringValue(payload.InputSource), stringValue(payload.InputMode), stringValue(payload.RawInput), floatValue(payload.AIConfidence))
}

func (s *Server) handleDeleteTransaction(w http.ResponseWriter, r *http.Request) {
	s.softDelete(w, r, "transactions", r.PathValue("id"))
}

func (s *Server) handleApproveTransaction(w http.ResponseWriter, r *http.Request) {
	s.updateTransactionStatus(w, r, r.PathValue("id"), "approved")
}

func (s *Server) handleRejectTransaction(w http.ResponseWriter, r *http.Request) {
	s.updateTransactionStatus(w, r, r.PathValue("id"), "rejected")
}

func (s *Server) handleBulkUpdateTransactions(w http.ResponseWriter, r *http.Request) {
	var payload bulkUpdatePayload
	if !decodeBody(w, r, &payload) {
		return
	}
	if len(payload.IDs) == 0 {
		writeError(w, http.StatusBadRequest, "ids are required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		with updated as (
			update transactions
			set
				status = coalesce($3::transaction_status, status),
				category_id = coalesce(nullif($4, '')::uuid, category_id)
			where user_id = $1 and id::text = any($2) and deleted_at is null
			returning *
		)
		select coalesce(jsonb_agg(to_jsonb(updated) order by updated.transaction_at desc), '[]'::jsonb)
		from updated
	`, userID(r), payload.IDs, stringValue(payload.Status), stringValueOrEmpty(payload.CategoryID))
}

func (s *Server) handleInboxTransactions(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
		from transactions t
		where t.user_id = $1
			and t.deleted_at is null
			and t.status in ('pending', 'needs_review')
	`, userID(r))
}

func (s *Server) handleListWebhookEvents(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
		from webhook_events e
		where e.user_id = $1 and e.deleted_at is null
	`, userID(r))
}

func (s *Server) handleGetWebhookEvent(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select to_jsonb(e)
		from webhook_events e
		where e.user_id = $1 and e.id = $2 and e.deleted_at is null
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleRetryWebhookEvent(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update webhook_events
		set status = 'received'
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(webhook_events.*)
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleListDeadLetters(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc), '[]'::jsonb)
		from dead_letter_queue d
		where d.user_id = $1 and d.deleted_at is null
	`, userID(r))
}

func (s *Server) handleGetDeadLetter(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select to_jsonb(d)
		from dead_letter_queue d
		where d.user_id = $1 and d.id = $2 and d.deleted_at is null
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleRetryDeadLetter(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update dead_letter_queue
		set status = 'open', resolved_at = null
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(dead_letter_queue.*)
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleResolveDeadLetter(w http.ResponseWriter, r *http.Request) {
	s.updateDeadLetterStatus(w, r, "resolved")
}

func (s *Server) handleIgnoreDeadLetter(w http.ResponseWriter, r *http.Request) {
	s.updateDeadLetterStatus(w, r, "ignored")
}

func (s *Server) handleListReimbursements(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		select coalesce(jsonb_agg(to_jsonb(t) order by t.transaction_at desc), '[]'::jsonb)
		from transactions t
		where t.user_id = $1
			and t.deleted_at is null
			and (t.is_reimbursement = true or t.reimbursement_status <> 'none')
	`, userID(r))
}

func (s *Server) handleMarkReimbursement(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update transactions
		set is_reimbursement = true, reimbursement_status = 'receivable'
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(transactions.*)
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleLinkReimbursement(w http.ResponseWriter, r *http.Request) {
	var payload reimbursementLinkPayload
	if !decodeBody(w, r, &payload) {
		return
	}
	if missing(payload.RelatedTransactionID) {
		writeError(w, http.StatusBadRequest, "related_transaction_id is required")
		return
	}
	s.writeQueryJSON(w, r, http.StatusOK, `
		update transactions
		set is_reimbursement = true,
			reimbursement_status = 'partially_reimbursed',
			related_transaction_id = $3
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(transactions.*)
	`, userID(r), r.PathValue("id"), stringValue(payload.RelatedTransactionID))
}

func (s *Server) handleSettleReimbursement(w http.ResponseWriter, r *http.Request) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update transactions
		set is_reimbursement = true, reimbursement_status = 'reimbursed'
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(transactions.*)
	`, userID(r), r.PathValue("id"))
}

func (s *Server) handleTransactionWebhook(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}

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

	idempotencyText := r.Header.Get("Idempotency-Key")
	if strings.TrimSpace(idempotencyText) == "" {
		hash := sha256.Sum256(body)
		idempotencyText = hex.EncodeToString(hash[:])
	}

	var eventJSON json.RawMessage
	err = s.db.QueryRow(r.Context(), `
		insert into webhook_events (user_id, source, idempotency_text, payload, status)
		values ($1, 'ios', $2, $3::jsonb, 'received')
		on conflict (user_id, idempotency_text) do nothing
		returning to_jsonb(webhook_events.*)
	`, userID(r), idempotencyText, string(body)).Scan(&eventJSON)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			s.writeDBError(w, err)
			return
		}

		err = s.db.QueryRow(r.Context(), `
			update webhook_events
			set status = 'duplicate'
			where user_id = $1 and idempotency_text = $2 and deleted_at is null
			returning to_jsonb(webhook_events.*)
		`, userID(r), idempotencyText).Scan(&eventJSON)
		if err != nil {
			s.writeDBError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":        "duplicate",
			"webhook_event": eventJSON,
		})
		return
	}

	var payload transactionPayload
	_ = json.Unmarshal(body, &payload)
	if missing(payload.WalletID) || missing(payload.Type) || payload.Amount == nil {
		var dlqJSON json.RawMessage
		err = s.db.QueryRow(r.Context(), `
			insert into dead_letter_queue (user_id, webhook_event_id, raw_payload, error_msg, status)
			values ($1, (select id from webhook_events where user_id = $1 and idempotency_text = $2), $3::jsonb, $4, 'open')
			returning to_jsonb(dead_letter_queue.*)
		`, userID(r), idempotencyText, string(body), "webhook payload missing wallet_id, type, or amount").Scan(&dlqJSON)
		if err != nil {
			s.writeDBError(w, err)
			return
		}
		var ignoredID string
		_ = s.db.QueryRow(r.Context(), `
			update webhook_events
			set status = 'failed'
			where user_id = $1 and idempotency_text = $2
			returning id
		`, userID(r), idempotencyText).Scan(&ignoredID)
		writeJSON(w, http.StatusAccepted, map[string]any{
			"status":        "dead_lettered",
			"webhook_event": eventJSON,
			"dead_letter":   dlqJSON,
		})
		return
	}

	status := "pending"
	payload.Status = &status
	source := "ios"
	mode := "text"
	payload.InputSource = &source
	payload.InputMode = &mode
	if payload.RawInput == nil {
		raw := string(body)
		payload.RawInput = &raw
	}
	normalizeTransactionPayload(&payload)
	transactionAt := time.Now().UTC().Format(time.RFC3339)
	if payload.TransactionAt != nil && strings.TrimSpace(*payload.TransactionAt) != "" {
		transactionAt = *payload.TransactionAt
	}

	var transactionJSON json.RawMessage
	err = s.db.QueryRow(r.Context(), createTransactionSQL(), transactionArgs(userID(r), payload, transactionAt)...).Scan(&transactionJSON)
	if err != nil {
		s.writeDBError(w, err)
		return
	}
	var ignoredID string
	_ = s.db.QueryRow(r.Context(), `
		update webhook_events
		set status = 'processed'
		where user_id = $1 and idempotency_text = $2
		returning id
	`, userID(r), idempotencyText).Scan(&ignoredID)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"status":        "accepted",
		"received_at":   time.Now().UTC(),
		"webhook_event": eventJSON,
		"transaction":   transactionJSON,
	})
}

func (s *Server) updateTransactionStatus(w http.ResponseWriter, r *http.Request, id, status string) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update transactions
		set status = $3::transaction_status
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(transactions.*)
	`, userID(r), id, status)
}

func (s *Server) updateDeadLetterStatus(w http.ResponseWriter, r *http.Request, status string) {
	s.writeQueryJSON(w, r, http.StatusOK, `
		update dead_letter_queue
		set status = $3::dead_letter_status,
			resolved_at = now()
		where user_id = $1 and id = $2 and deleted_at is null
		returning to_jsonb(dead_letter_queue.*)
	`, userID(r), r.PathValue("id"), status)
}

func (s *Server) softDelete(w http.ResponseWriter, r *http.Request, table, id string) {
	sql := "update " + table + " set deleted_at = now() where user_id = $1 and id = $2 and deleted_at is null returning jsonb_build_object('id', id, 'deleted_at', deleted_at)"
	s.writeQueryJSON(w, r, http.StatusOK, sql, userID(r), id)
}

func (s *Server) writeQueryJSON(w http.ResponseWriter, r *http.Request, status int, sql string, args ...any) {
	if s.db == nil {
		writeError(w, http.StatusServiceUnavailable, "database is not configured")
		return
	}

	var payload json.RawMessage
	if err := s.db.QueryRow(r.Context(), sql, args...).Scan(&payload); err != nil {
		s.writeDBError(w, err)
		return
	}

	writeRawJSON(w, status, payload)
}

func (s *Server) writeDBError(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "resource not found")
		return
	}
	s.logger.Error("database query failed", "error", err)
	writeError(w, http.StatusInternalServerError, "database query failed")
}

func createTransactionSQL() string {
	return `
		insert into transactions (
			user_id,
			wallet_id,
			destination_wallet_id,
			type,
			status,
			transaction_at,
			merchant,
			amount,
			category_id,
			is_reimbursement,
			reimbursement_status,
			related_transaction_id,
			note,
			input_source,
			input_mode,
			raw_input,
			ai_confidence
		)
		values (
			$1,
			$2::uuid,
			nullif($3, '')::uuid,
			$4::transaction_type,
			coalesce($5::transaction_status, 'pending'),
			$6::timestamptz,
			$7,
			$8,
			nullif($9, '')::uuid,
			coalesce($10, false),
			coalesce($11::reimbursement_status, 'none'),
			nullif($12, '')::uuid,
			$13,
			$14::input_source,
			$15::input_mode,
			$16,
			$17
		)
		returning to_jsonb(transactions.*)
	`
}

func transactionArgs(requestUserID string, payload transactionPayload, transactionAt string) []any {
	return []any{
		requestUserID,
		stringValue(payload.WalletID),
		stringValueOrEmpty(payload.DestinationWalletID),
		stringValue(payload.Type),
		stringValue(payload.Status),
		transactionAt,
		stringValue(payload.Merchant),
		floatValue(payload.Amount),
		stringValueOrEmpty(payload.CategoryID),
		boolValue(payload.IsReimbursement),
		stringValue(payload.ReimbursementStatus),
		stringValueOrEmpty(payload.RelatedTransactionID),
		stringValue(payload.Note),
		stringValue(payload.InputSource),
		stringValue(payload.InputMode),
		stringValue(payload.RawInput),
		floatValue(payload.AIConfidence),
	}
}

func normalizeTransactionPayload(payload *transactionPayload) {
	if payload.IsReimbursement != nil && *payload.IsReimbursement && payload.ReimbursementStatus == nil {
		status := "receivable"
		payload.ReimbursementStatus = &status
	}
}

func decodeBody(w http.ResponseWriter, r *http.Request, target any) bool {
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func writeRawJSON(w http.ResponseWriter, status int, payload json.RawMessage) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(payload)
}

func missing(value *string) bool {
	return value == nil || strings.TrimSpace(*value) == ""
}

func stringValue(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func stringValueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func floatValue(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func boolValue(value *bool) any {
	if value == nil {
		return nil
	}
	return *value
}
