package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func fundAmount(t *testing.T, pool *pgxpool.Pool, table, id string) (current, ledger float64) {
	t.Helper()
	column := map[string]string{"sinking_funds": "sinking_fund_id", "saving_goals": "saving_goal_id"}[table]
	if err := pool.QueryRow(context.Background(), fmt.Sprintf(`
		select f.current_amount::float8, coalesce((select sum(amount) from fund_entries e where e.%s = f.id), 0)::float8
		from %s f where f.id = $1
	`, column, table), id).Scan(&current, &ledger); err != nil {
		t.Fatal(err)
	}
	return
}

func TestFundDepositWithdrawKeepsLedger(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 1_000_000)

	code, fund := callAs(t, s, alice.ID, "POST", "/sinking-funds",
		fmt.Sprintf(`{"name":"Servis motor","target_amount":600000,"current_amount":100000,"wallet_id":%q}`, alice.WalletID))
	if code != http.StatusCreated {
		t.Fatalf("create fund: %d %v", code, fund)
	}
	id := fund["id"].(string)
	if current, ledger := fundAmount(t, pool, "sinking_funds", id); current != 100_000 || ledger != 100_000 {
		t.Fatalf("opening: current=%v ledger=%v", current, ledger)
	}

	code, entry := callAs(t, s, alice.ID, "POST", "/sinking-funds/"+id+"/entries", `{"amount":250000}`)
	if code != http.StatusCreated || entry["fund_current_amount"].(float64) != 350_000 || entry["wallet_id"] != alice.WalletID {
		t.Fatalf("deposit: %d %v", code, entry)
	}
	if code, body := callAs(t, s, alice.ID, "POST", "/sinking-funds/"+id+"/entries", `{"type":"withdraw","amount":50000}`); code != http.StatusCreated {
		t.Fatalf("withdraw: %d %v", code, body)
	}
	if current, ledger := fundAmount(t, pool, "sinking_funds", id); current != 300_000 || ledger != 300_000 {
		t.Fatalf("after deposit and withdraw: current=%v ledger=%v", current, ledger)
	}

	// Withdrawing more than the fund holds is refused and leaves no entry behind.
	if code, _ := callAs(t, s, alice.ID, "POST", "/sinking-funds/"+id+"/entries", `{"type":"withdraw","amount":999999}`); code != http.StatusBadRequest {
		t.Fatalf("overdraw: want 400, got %d", code)
	}
	if current, ledger := fundAmount(t, pool, "sinking_funds", id); current != 300_000 || ledger != 300_000 {
		t.Fatalf("after refused overdraw: current=%v ledger=%v", current, ledger)
	}

	// An old client PATCHing current_amount becomes an adjustment entry.
	if code, _ := callAs(t, s, alice.ID, "PATCH", "/sinking-funds/"+id, `{"current_amount":320000}`); code != http.StatusOK {
		t.Fatal("patch failed")
	}
	if current, ledger := fundAmount(t, pool, "sinking_funds", id); current != 320_000 || ledger != 320_000 {
		t.Fatalf("after patch: current=%v ledger=%v", current, ledger)
	}

	// Deleting the deposit recomputes the fund.
	if code, _ := callAs(t, s, alice.ID, "DELETE", "/fund-entries/"+entry["id"].(string), ``); code != http.StatusOK {
		t.Fatal("delete entry failed")
	}
	if current, _ := fundAmount(t, pool, "sinking_funds", id); current != 70_000 {
		t.Fatalf("after deleting the 250k deposit: %v", current)
	}

	code, list := callAsList(t, s, alice.ID, "GET", "/sinking-funds/"+id+"/entries")
	if code != http.StatusOK || len(list) != 3 {
		t.Fatalf("entries: %d %v", code, list)
	}
}

func TestFundEntriesStayWithOwner(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	bob := seedUser(t, pool, "bob@example.invalid", 0)
	_, fund := callAs(t, s, alice.ID, "POST", "/saving-goals", `{"name":"Laptop","target_amount":9000000}`)
	id := fund["id"].(string)

	if code, _ := callAs(t, s, bob.ID, "POST", "/saving-goals/"+id+"/entries", `{"amount":1000}`); code != http.StatusNotFound {
		t.Fatalf("deposit into another user's goal: want 404, got %d", code)
	}
	if code, _ := callAs(t, s, alice.ID, "POST", "/saving-goals/"+id+"/entries",
		fmt.Sprintf(`{"amount":1000,"wallet_id":%q}`, bob.WalletID)); code != http.StatusBadRequest {
		t.Fatalf("deposit tagged with another user's wallet: want 400, got %d", code)
	}
	if code, _ := callAs(t, s, bob.ID, "GET", "/saving-goals/"+id+"/entries", ``); code != http.StatusNotFound {
		t.Fatalf("list another user's entries: want 404, got %d", code)
	}
}

func TestAppliedAllocationFillsFundOnce(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	income := insertTx(t, pool, alice, "income", 5_000_000, false)
	_, fund := callAs(t, s, alice.ID, "POST", "/sinking-funds",
		fmt.Sprintf(`{"name":"Darurat","target_amount":10000000,"wallet_id":%q}`, alice.WalletID))
	fundID := fund["id"].(string)

	code, alloc := callAs(t, s, alice.ID, "POST", "/income-allocations",
		fmt.Sprintf(`{"income_transaction_id":%q,"sinking_fund_id":%q,"amount":500000}`, income, fundID))
	if code != http.StatusCreated {
		t.Fatalf("allocation: %d %v", code, alloc)
	}
	allocID := alloc["id"].(string)
	if current, _ := fundAmount(t, pool, "sinking_funds", fundID); current != 0 {
		t.Fatalf("planned allocation must not move money, got %v", current)
	}

	for i := 0; i < 2; i++ { // applying twice must not double the money
		if code, _ := callAs(t, s, alice.ID, "PATCH", "/income-allocations/"+allocID, `{"status":"applied"}`); code != http.StatusOK {
			t.Fatal("apply failed")
		}
	}
	if current, ledger := fundAmount(t, pool, "sinking_funds", fundID); current != 500_000 || ledger != 500_000 {
		t.Fatalf("applied: current=%v ledger=%v", current, ledger)
	}

	var entryID string
	if err := pool.QueryRow(context.Background(), `select id::text from fund_entries where income_allocation_id = $1`, allocID).Scan(&entryID); err != nil {
		t.Fatal(err)
	}
	if code, _ := callAs(t, s, alice.ID, "DELETE", "/fund-entries/"+entryID, ``); code != http.StatusBadRequest {
		t.Fatalf("deleting an allocation entry directly: want 400, got %d", code)
	}

	if code, _ := callAs(t, s, alice.ID, "PATCH", "/income-allocations/"+allocID, `{"status":"cancelled"}`); code != http.StatusOK {
		t.Fatal("cancel failed")
	}
	if current, _ := fundAmount(t, pool, "sinking_funds", fundID); current != 0 {
		t.Fatalf("cancelled allocation must take the money back out, got %v", current)
	}
}

func TestWalletEnvelopesShowAvailable(t *testing.T) {
	pool := integrationDB(t)
	s := &Server{db: pool, logger: slog.Default()}
	alice := seedUser(t, pool, "alice@example.invalid", 1_000_000)
	callAs(t, s, alice.ID, "POST", "/sinking-funds",
		fmt.Sprintf(`{"name":"Pajak","target_amount":2000000,"current_amount":400000,"wallet_id":%q}`, alice.WalletID))
	callAs(t, s, alice.ID, "POST", "/saving-goals",
		fmt.Sprintf(`{"name":"Liburan","target_amount":5000000,"current_amount":800000,"wallet_id":%q}`, alice.WalletID))

	code, list := callAsList(t, s, alice.ID, "GET", "/wallets/envelopes")
	if code != http.StatusOK || len(list) != 1 {
		t.Fatalf("envelopes: %d %v", code, list)
	}
	row := list[0]
	if row["reserved"].(float64) != 1_200_000 || row["available"].(float64) != -200_000 || row["over_reserved"] != true {
		t.Fatalf("want reserved 1.2M, available -200k, over_reserved: %v", row)
	}
}

func TestMigrationOpensLedgerForExistingFunds(t *testing.T) {
	pool := integrationDB(t)
	ctx := context.Background()
	alice := seedUser(t, pool, "alice@example.invalid", 0)
	var fundID string
	if err := pool.QueryRow(ctx, `
		insert into sinking_funds (user_id, name, target_amount, current_amount) values ($1, 'Lama', 100, 0) returning id::text
	`, alice.ID).Scan(&fundID); err != nil {
		t.Fatal(err)
	}
	// Old shape: an amount with no ledger behind it.
	if _, err := pool.Exec(ctx, `
		alter table sinking_funds disable trigger user;
		update sinking_funds set current_amount = 75 where id = $1;
		delete from fund_entries;
		alter table sinking_funds enable trigger user;
	`, fundID); err != nil {
		t.Fatal(err)
	}
	b, err := readMigration("017_fund_entries.sql")
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ { // idempotent
		if _, err := pool.Exec(ctx, b); err != nil {
			t.Fatal(err)
		}
	}
	if current, ledger := fundAmount(t, pool, "sinking_funds", fundID); current != 75 || ledger != 75 {
		t.Fatalf("migrated: current=%v ledger=%v", current, ledger)
	}
}

// callAsList is callAs for endpoints that answer with a JSON array.
func callAsList(t *testing.T, s *Server, user, method, path string) (int, []map[string]any) {
	t.Helper()
	mux := http.NewServeMux()
	s.registerResources(mux)
	s.registerExtendedResources(mux)
	req := withUserID(httptest.NewRequest(method, path, nil), user)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var out []map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}
