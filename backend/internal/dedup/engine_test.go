package dedup_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"zero-friction-erp/backend/internal/dedup"
)

type mockRow struct {
	val string
	err error
}

func (m mockRow) Scan(dest ...any) error {
	if m.err != nil {
		return m.err
	}
	if len(dest) > 0 {
		if ptr, ok := dest[0].(*string); ok {
			*ptr = m.val
		}
	}
	return nil
}

type mockQueryable struct {
	queryFn func(ctx context.Context, sql string, args ...any) pgx.Row
}

func (m *mockQueryable) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.queryFn != nil {
		return m.queryFn(ctx, sql, args...)
	}
	return mockRow{err: pgx.ErrNoRows}
}

func TestLayer1ExactHashDrop(t *testing.T) {
	ctx := context.Background()
	existingID := "11111111-1111-1111-1111-111111111111"

	db := &mockQueryable{
		queryFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			if strings.Contains(sql, "dedup_hash = $2") {
				return mockRow{val: existingID}
			}
			return mockRow{err: pgx.ErrNoRows}
		},
	}

	p := dedup.CheckParams{
		UserID:   "user-1",
		Source:   "android",
		AppName:  "GoPay",
		Amount:   35000,
		PostedAt: time.Date(2026, 10, 23, 10, 15, 30, 0, time.UTC),
	}

	res, err := dedup.Check(ctx, db, p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Action != dedup.ActionDrop {
		t.Errorf("expected ActionDrop, got %s", res.Action)
	}
	if res.Layer != 1 {
		t.Errorf("expected layer 1, got %d", res.Layer)
	}
	if res.DuplicateOf != existingID {
		t.Errorf("expected DuplicateOf %s, got %s", existingID, res.DuplicateOf)
	}
	if res.Reason != "exact_hash_match_within_5_minutes" {
		t.Errorf("expected exact_hash_match_within_5_minutes, got %s", res.Reason)
	}
}

func TestLayer2ReferenceNumberMerge(t *testing.T) {
	ctx := context.Background()
	existingID := "22222222-2222-2222-2222-222222222222"

	db := &mockQueryable{
		queryFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			// Layer 1 misses
			if strings.Contains(sql, "dedup_hash = $2") {
				return mockRow{err: pgx.ErrNoRows}
			}
			// Layer 2 hits
			if strings.Contains(sql, "raw_input like '%'") {
				return mockRow{val: existingID}
			}
			return mockRow{err: pgx.ErrNoRows}
		},
	}

	p := dedup.CheckParams{
		UserID:    "user-1",
		Source:    "android",
		AppName:   "OCTO Mobile",
		Amount:    500000,
		RefNumber: "CIMB-883921",
		PostedAt:  time.Date(2026, 10, 23, 10, 15, 30, 0, time.UTC),
	}

	res, err := dedup.Check(ctx, db, p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Action != dedup.ActionMerge {
		t.Errorf("expected ActionMerge, got %s", res.Action)
	}
	if res.Layer != 2 {
		t.Errorf("expected layer 2, got %d", res.Layer)
	}
	if res.DuplicateOf != existingID {
		t.Errorf("expected DuplicateOf %s, got %s", existingID, res.DuplicateOf)
	}
	if res.Reason != "reference_number_match" {
		t.Errorf("expected reference_number_match, got %s", res.Reason)
	}
}

func TestLayer3CrossSourceWindowWarn(t *testing.T) {
	ctx := context.Background()
	existingID := "33333333-3333-3333-3333-333333333333"

	db := &mockQueryable{
		queryFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			// Layer 1 misses
			if strings.Contains(sql, "dedup_hash = $2") {
				return mockRow{err: pgx.ErrNoRows}
			}
			// Layer 2 misses
			if strings.Contains(sql, "raw_input like '%'") {
				return mockRow{err: pgx.ErrNoRows}
			}
			// Layer 3 hits
			if strings.Contains(sql, "input_source is distinct from") {
				return mockRow{val: existingID}
			}
			return mockRow{err: pgx.ErrNoRows}
		},
	}

	p := dedup.CheckParams{
		UserID:    "user-1",
		Source:    "android",
		AppName:   "GoPay",
		Amount:    25000,
		RefNumber: "",
		PostedAt:  time.Date(2026, 10, 23, 10, 15, 30, 0, time.UTC),
	}

	res, err := dedup.Check(ctx, db, p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Action != dedup.ActionWarn {
		t.Errorf("expected ActionWarn, got %s", res.Action)
	}
	if res.Layer != 3 {
		t.Errorf("expected layer 3, got %d", res.Layer)
	}
	if res.DuplicateOf != existingID {
		t.Errorf("expected DuplicateOf %s, got %s", existingID, res.DuplicateOf)
	}
	if res.Reason != "cross_source_window_similarity" {
		t.Errorf("expected cross_source_window_similarity, got %s", res.Reason)
	}
}

func TestPassWhenNoDuplicate(t *testing.T) {
	ctx := context.Background()

	db := &mockQueryable{
		queryFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return mockRow{err: pgx.ErrNoRows}
		},
	}

	p := dedup.CheckParams{
		UserID:    "user-1",
		Source:    "android",
		AppName:   "blu by BCA",
		Amount:    75000,
		RefNumber: "BLU-12345",
		PostedAt:  time.Date(2026, 10, 23, 11, 0, 0, 0, time.UTC),
	}

	res, err := dedup.Check(ctx, db, p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Action != dedup.ActionPass {
		t.Errorf("expected ActionPass, got %s", res.Action)
	}
	if res.Layer != 0 {
		t.Errorf("expected layer 0, got %d", res.Layer)
	}
	if res.DuplicateOf != "" {
		t.Errorf("expected empty DuplicateOf, got %s", res.DuplicateOf)
	}
}

func TestComputeHashConsistency(t *testing.T) {
	t1 := time.Date(2026, 10, 23, 14, 20, 15, 0, time.UTC)
	t2 := time.Date(2026, 10, 23, 14, 20, 45, 0, time.UTC) // same minute
	t3 := time.Date(2026, 10, 23, 14, 21, 15, 0, time.UTC) // next minute

	p1 := dedup.CheckParams{
		UserID:   "user-123",
		AppName:  " GoPay ",
		Amount:   50000,
		PostedAt: t1,
	}
	p2 := dedup.CheckParams{
		UserID:   "user-123",
		AppName:  "gopay",
		Amount:   50000,
		PostedAt: t2,
	}
	p3 := dedup.CheckParams{
		UserID:   "user-123",
		AppName:  "gopay",
		Amount:   50000,
		PostedAt: t3,
	}
	pDiffAmount := dedup.CheckParams{
		UserID:   "user-123",
		AppName:  "gopay",
		Amount:   50001,
		PostedAt: t1,
	}

	hash1 := dedup.ComputeHash(p1)
	hash2 := dedup.ComputeHash(p2)
	hash3 := dedup.ComputeHash(p3)
	hashDiff := dedup.ComputeHash(pDiffAmount)

	if hash1 == "" {
		t.Fatal("expected non-empty hash")
	}
	if hash1 != hash2 {
		t.Errorf("expected same hash within same minute bucket, got %s vs %s", hash1, hash2)
	}
	if hash1 == hash3 {
		t.Errorf("expected different hash in different minute bucket")
	}
	if hash1 == hashDiff {
		t.Errorf("expected different hash with different amount")
	}
}

func TestDBErrorPropagation(t *testing.T) {
	ctx := context.Background()
	expectedErr := errors.New("db connection failure")

	db := &mockQueryable{
		queryFn: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return mockRow{err: expectedErr}
		},
	}

	p := dedup.CheckParams{
		UserID:   "user-1",
		Source:   "android",
		AppName:  "blu",
		Amount:   20000,
		PostedAt: time.Now(),
	}

	_, err := dedup.Check(ctx, db, p)
	if err == nil || !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}
}
