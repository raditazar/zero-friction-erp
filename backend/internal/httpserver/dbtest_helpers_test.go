package httpserver

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// integrationDB returns a pool on a fresh schema with every migration applied (seed data
// excluded). It skips unless ZFE_TEST_DATABASE_URL points at a disposable local database.
func integrationDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("ZFE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set ZFE_TEST_DATABASE_URL to a disposable local PostgreSQL database")
	}
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if config.ConnConfig.Host != "127.0.0.1" && config.ConnConfig.Host != "localhost" {
		t.Fatal("integration tests require a local disposable PostgreSQL")
	}
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	admin, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("zfe_test_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "create schema "+quoted); err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "drop schema "+quoted+" cascade")
		admin.Close()
	})

	files, err := filepath.Glob("../../../database/migrations/*.sql")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(files)
	for _, file := range files {
		if strings.Contains(filepath.Base(file), "seed") {
			continue
		}
		b, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		sql := string(b)
		// goose-style files carry their rollback after this marker; run only the Up part.
		if i := strings.Index(sql, "-- +goose Down"); i >= 0 {
			sql = sql[:i]
		}
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatalf("%s: %v", filepath.Base(file), err)
		}
	}
	return pool
}

type testUser struct {
	ID       string
	WalletID string
}

// seedUser creates a user with one active IDR wallet holding initBalance.
func seedUser(t *testing.T, pool *pgxpool.Pool, email string, initBalance int) testUser {
	t.Helper()
	ctx := context.Background()
	var u testUser
	if err := pool.QueryRow(ctx, `insert into users(email) values($1) returning id::text`, email).Scan(&u.ID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		insert into wallets(user_id, name, category, currency, init_balance)
		values ($1, 'Dompet ' || $2, 'bank', 'IDR', $3) returning id::text
	`, u.ID, email, initBalance).Scan(&u.WalletID); err != nil {
		t.Fatal(err)
	}
	return u
}

func walletBalance(t *testing.T, pool *pgxpool.Pool, walletID string) float64 {
	t.Helper()
	var balance float64
	if err := pool.QueryRow(context.Background(), `select curr_balance::float8 from wallet_balances where id = $1`, walletID).Scan(&balance); err != nil {
		t.Fatal(err)
	}
	return balance
}
