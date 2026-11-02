package httpserver

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
)

type fakeTx struct {
	pgx.Tx
	committed  bool
	rolledBack bool
}

func (f *fakeTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row { return nil }
func (f *fakeTx) Commit(ctx context.Context) error                              { f.committed = true; return nil }
func (f *fakeTx) Rollback(ctx context.Context) error                            { f.rolledBack = true; return nil }

type fakeTxDB struct {
	tx *fakeTx
}

func (f *fakeTxDB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row { return nil }
func (f *fakeTxDB) Begin(ctx context.Context) (pgx.Tx, error)                     { return f.tx, nil }

func TestWithTxCommitsOnSuccess(t *testing.T) {
	db := &fakeTxDB{tx: &fakeTx{}}
	s := &Server{db: db}
	if err := s.withTx(context.Background(), func(q rowQuerier) error { return nil }); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !db.tx.committed || db.tx.rolledBack {
		t.Fatalf("want commit only, got committed=%v rolledBack=%v", db.tx.committed, db.tx.rolledBack)
	}
}

func TestWithTxRollsBackOnError(t *testing.T) {
	db := &fakeTxDB{tx: &fakeTx{}}
	s := &Server{db: db}
	boom := errors.New("insert failed")
	err := s.withTx(context.Background(), func(q rowQuerier) error { return boom })
	if !errors.Is(err, boom) {
		t.Fatalf("want boom, got %v", err)
	}
	if db.tx.committed || !db.tx.rolledBack {
		t.Fatalf("want rollback only, got committed=%v rolledBack=%v", db.tx.committed, db.tx.rolledBack)
	}
}
