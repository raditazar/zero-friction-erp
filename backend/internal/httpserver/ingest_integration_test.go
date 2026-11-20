package httpserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestOwnershipTriggerRejectsForeignWallet(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	alice := seedUser(t, pool, "alice@example.invalid", 1000)
	bob := seedUser(t, pool, "bob@example.invalid", 500)

	_, err := pool.Exec(ctx, `
		insert into transactions(user_id, wallet_id, type, status, transaction_at, amount)
		values ($1, $2, 'expense', 'approved', now(), 100)
	`, bob.ID, alice.WalletID)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "ZF403" {
		t.Fatalf("want ZF403 for a foreign wallet, got %v", err)
	}
	if got := walletBalance(t, pool, alice.WalletID); got != 1000 {
		t.Fatalf("alice's balance changed to %v", got)
	}

	// Own wallet still works, and moving a row onto a foreign wallet is rejected too.
	var txID string
	if err := pool.QueryRow(ctx, `
		insert into transactions(user_id, wallet_id, type, status, transaction_at, amount)
		values ($1, $2, 'expense', 'approved', now(), 100) returning id::text
	`, bob.ID, bob.WalletID).Scan(&txID); err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `update transactions set wallet_id = $2 where id = $1`, txID, alice.WalletID)
	if !errors.As(err, &pgErr) || pgErr.Code != "ZF403" {
		t.Fatalf("want ZF403 when moving onto a foreign wallet, got %v", err)
	}
	// Updating other columns of an existing row is not blocked.
	if _, err := pool.Exec(ctx, `update transactions set note = 'ok' where id = $1`, txID); err != nil {
		t.Fatal(err)
	}
	if got := walletBalance(t, pool, bob.WalletID); got != 400 {
		t.Fatalf("bob's balance = %v, want 400", got)
	}
}

func TestWalletBalancesIgnoreOtherUsersRows(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	alice := seedUser(t, pool, "alice@example.invalid", 1000)
	bob := seedUser(t, pool, "bob@example.invalid", 0)
	// Simulate a row written before migration 012 by bypassing the trigger.
	if _, err := pool.Exec(ctx, `alter table transactions disable trigger transactions_same_owner`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		insert into transactions(user_id, wallet_id, type, status, transaction_at, amount)
		values ($1, $2, 'expense', 'approved', now(), 300)
	`, bob.ID, alice.WalletID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `alter table transactions enable trigger transactions_same_owner`); err != nil {
		t.Fatal(err)
	}
	if got := walletBalance(t, pool, alice.WalletID); got != 1000 {
		t.Fatalf("foreign row moved alice's balance to %v", got)
	}
}

func TestWebhookIngestDeadLettersBadWalletAndRetrySucceeds(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 1000)
	bob := seedUser(t, pool, "bob@example.invalid", 0)

	// Bob sends Alice's wallet id: rejected by the owner trigger, kept in the dead-letter queue.
	bad := []byte(fmt.Sprintf(`{"wallet_id":%q,"type":"expense","amount":25000,"merchant":"Kopi"}`, alice.WalletID))
	outcome, err := s.ingestWebhook(ctx, bob.ID, "ios", "key-1", bad)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.Status != "dead_lettered" || outcome.DeadLetter == nil {
		t.Fatalf("want dead_lettered, got %+v", outcome)
	}

	// The client retries with the same key and a corrected body: processed, not a duplicate.
	good := []byte(fmt.Sprintf(`{"wallet_id":%q,"type":"expense","amount":25000,"merchant":"Kopi"}`, bob.WalletID))
	outcome, err = s.ingestWebhook(ctx, bob.ID, "ios", "key-1", good)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.Status != "accepted" || outcome.Transaction == nil {
		t.Fatalf("want accepted on retry after failure, got %+v", outcome)
	}

	// A third send with the same key is now a duplicate and creates nothing.
	outcome, err = s.ingestWebhook(ctx, bob.ID, "ios", "key-1", good)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.Status != "duplicate" {
		t.Fatalf("want duplicate, got %q", outcome.Status)
	}
	var count int
	if err := pool.QueryRow(ctx, `select count(*) from transactions where user_id = $1`, bob.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("want exactly 1 transaction, got %d", count)
	}
}

func TestDeadLetterRetryWithCorrectedPayload(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	bob := seedUser(t, pool, "bob@example.invalid", 0)

	outcome, err := s.ingestWebhook(ctx, bob.ID, "ios", "key-2", []byte(`{"merchant":"Parkir","amount":5000}`))
	if err != nil {
		t.Fatal(err)
	}
	if outcome.Status != "dead_lettered" {
		t.Fatalf("want dead_lettered for missing wallet/type, got %q", outcome.Status)
	}
	var eventID string
	if err := pool.QueryRow(ctx, `select id::text from webhook_events where user_id = $1`, bob.ID).Scan(&eventID); err != nil {
		t.Fatal(err)
	}

	fixed := []byte(fmt.Sprintf(`{"wallet_id":%q,"type":"expense","amount":5000,"merchant":"Parkir"}`, bob.WalletID))
	outcome, err = s.retryWebhookEvent(ctx, bob.ID, eventID, fixed)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.Status != "accepted" {
		t.Fatalf("want accepted, got %q", outcome.Status)
	}
	var open int
	if err := pool.QueryRow(ctx, `select count(*) from dead_letter_queue where user_id = $1 and status = 'open'`, bob.ID).Scan(&open); err != nil {
		t.Fatal(err)
	}
	if open != 0 {
		t.Fatalf("old dead letter should be resolved, %d still open", open)
	}
	if _, err := s.retryWebhookEvent(ctx, bob.ID, eventID, nil); !errors.Is(err, errAlreadyProcessed) {
		t.Fatalf("retrying a processed event: want errAlreadyProcessed, got %v", err)
	}
}

func TestAllowRateCountsPerUserWindow(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	s := &Server{db: pool, logger: slog.Default()}
	bob := seedUser(t, pool, "bob@example.invalid", 0)
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	rl := rateLimit{bucket: "test", limit: 3, window: time.Hour}
	for i := 1; i <= 3; i++ {
		if ok, _ := s.allowRate(ctx, bob.ID, rl); !ok {
			t.Fatalf("call %d should be allowed", i)
		}
	}
	ok, retry := s.allowRate(ctx, bob.ID, rl)
	if ok || retry <= 0 {
		t.Fatalf("4th call should be limited with a retry delay, got ok=%v retry=%v", ok, retry)
	}
	if ok, _ := s.allowRate(ctx, alice.ID, rl); !ok {
		t.Fatal("another user's counter must be separate")
	}
}
