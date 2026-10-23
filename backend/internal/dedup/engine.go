package dedup

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Queryable defines the minimal database row query interface needed for dedup checks
type Queryable interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type ActionType string

const (
	ActionPass  ActionType = "pass"
	ActionDrop  ActionType = "drop"
	ActionMerge ActionType = "merge"
	ActionWarn  ActionType = "warn"
)

type CheckParams struct {
	UserID    string
	Source    string // "android", "ios", "gmail"
	DeviceID  string
	AppName   string
	Amount    float64
	Merchant  string
	RefNumber string
	PostedAt  time.Time
	RawText   string
}

type CheckResult struct {
	Action      ActionType `json:"action"`
	Layer       int        `json:"layer"`
	DuplicateOf string     `json:"duplicate_of,omitempty"`
	DedupHash   string     `json:"dedup_hash"`
	Reason      string     `json:"reason,omitempty"`
}

// ComputeHash generates a deterministic SHA-256 fingerprint for Layer 1 idempotency
func ComputeHash(p CheckParams) string {
	postedAt := p.PostedAt
	if postedAt.IsZero() {
		postedAt = time.Now().UTC()
	}
	minuteBucket := postedAt.Truncate(time.Minute).UTC().Format("2006-01-02T15:04")
	normApp := strings.ToLower(strings.TrimSpace(p.AppName))
	raw := fmt.Sprintf("%s:%s:%.0f:%s", p.UserID, normApp, p.Amount, minuteBucket)
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// Check evaluates incoming transaction parameters against the 3-tier anti-duplication engine.
// Tier 1 (Exact hash drop within 5 min window)
// Tier 2 (Reference number merge within 24h)
// Tier 3 (Cross-source window warning within ±10 min)
func Check(ctx context.Context, db Queryable, p CheckParams) (CheckResult, error) {
	if p.PostedAt.IsZero() {
		p.PostedAt = time.Now().UTC()
	}
	hash := ComputeHash(p)

	if db == nil {
		return CheckResult{
			Action:    ActionPass,
			Layer:     0,
			DedupHash: hash,
		}, nil
	}

	// Lapis 1: Exact hash match on transactions within ±5 minutes
	var existingTxID string
	err := db.QueryRow(ctx, `
		select id::text
		from transactions
		where user_id = $1::uuid
		  and dedup_hash = $2
		  and transaction_at >= ($3::timestamptz - interval '5 minutes')
		  and transaction_at <= ($3::timestamptz + interval '5 minutes')
		  and deleted_at is null
		limit 1
	`, p.UserID, hash, p.PostedAt).Scan(&existingTxID)
	if err == nil && existingTxID != "" {
		return CheckResult{
			Action:      ActionDrop,
			Layer:       1,
			DuplicateOf: existingTxID,
			DedupHash:   hash,
			Reason:      "exact_hash_match_within_5_minutes",
		}, nil
	} else if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return CheckResult{}, err
	}

	// Lapis 2: Reference Number match within 24 hours
	if ref := strings.TrimSpace(p.RefNumber); ref != "" {
		var refTxID string
		err := db.QueryRow(ctx, `
			select id::text
			from transactions
			where user_id = $1::uuid
			  and (raw_input like '%' || $2 || '%' or note like '%' || $2 || '%')
			  and transaction_at >= ($3::timestamptz - interval '24 hours')
			  and deleted_at is null
			limit 1
		`, p.UserID, ref, p.PostedAt).Scan(&refTxID)
		if err == nil && refTxID != "" {
			return CheckResult{
				Action:      ActionMerge,
				Layer:       2,
				DuplicateOf: refTxID,
				DedupHash:   hash,
				Reason:      "reference_number_match",
			}, nil
		} else if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return CheckResult{}, err
		}
	}

	// Lapis 3: Cross-source window similarity (same amount, distinct source, ±10 minutes)
	var similarTxID string
	err = db.QueryRow(ctx, `
		select id::text
		from transactions
		where user_id = $1::uuid
		  and abs(amount - $2) < 0.01
		  and transaction_at >= ($3::timestamptz - interval '10 minutes')
		  and transaction_at <= ($3::timestamptz + interval '10 minutes')
		  and (input_source is distinct from $4)
		  and deleted_at is null
		order by created_at desc
		limit 1
	`, p.UserID, p.Amount, p.PostedAt, p.Source).Scan(&similarTxID)
	if err == nil && similarTxID != "" {
		return CheckResult{
			Action:      ActionWarn,
			Layer:       3,
			DuplicateOf: similarTxID,
			DedupHash:   hash,
			Reason:      "cross_source_window_similarity",
		}, nil
	} else if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return CheckResult{}, err
	}

	return CheckResult{
		Action:    ActionPass,
		Layer:     0,
		DedupHash: hash,
	}, nil
}
