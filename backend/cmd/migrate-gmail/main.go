// Explicit, checksum-verified migration. This never uses startup schema bootstrap.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "Gmail migration failed; database changes rolled back. Check DB access and migration checksum.")
		os.Exit(1)
	}
	fmt.Println("Gmail migration applied/verified.")
}
func run() error {
	if len(os.Args) != 2 || os.Getenv("DATABASE_URL") == "" {
		return fmt.Errorf("usage: set DATABASE_URL, then go run ./cmd/migrate-gmail ../database/migrations/007_gmail_integration.sql")
	}
	b, err := os.ReadFile(os.Args[1])
	if err != nil {
		return err
	}
	// Keep verification stable between Windows checkouts and Linux deployments.
	canonical := strings.ReplaceAll(string(b), "\r\n", "\n")
	hash := sha256.Sum256([]byte(canonical))
	checksum := hex.EncodeToString(hash[:])
	sql := strings.TrimSpace(canonical)
	sql = strings.TrimPrefix(sql, "begin;")
	sql = strings.TrimSuffix(sql, "commit;")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	config, err := pgx.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	config.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	conn, err := pgx.ConnectConfig(ctx, config)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(702007); create table if not exists erp_schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())`); err != nil {
		return err
	}
	var previous string
	err = tx.QueryRow(ctx, `select checksum from erp_schema_migrations where name='007_gmail_integration'`).Scan(&previous)
	if err == pgx.ErrNoRows {
		if _, err := tx.Exec(ctx, sql); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `insert into erp_schema_migrations(name,checksum) values('007_gmail_integration',$1)`, checksum); err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else if previous != checksum {
		return fmt.Errorf("migration checksum changed")
	}
	var valid bool
	err = tx.QueryRow(ctx, `select to_regclass('gmail_connections') is not null and to_regclass('gmail_messages') is not null and to_regclass('gmail_oauth_states') is not null`).Scan(&valid)
	if err != nil || !valid {
		return fmt.Errorf("schema validation failed")
	}
	return tx.Commit(ctx)
}
