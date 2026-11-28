-- Migration 018: match a wallet's balance to reality.
--
-- When the app's balance differs from the real one, the user types the real balance and the
-- difference is recorded either as an ordinary income/expense (it counts in reports) or as an
-- adjustment (it does not). Adjustments were already left out of analytics and budgets, but
-- amount had to be positive, so an adjustment could only raise a balance; lowering one needed
-- a fake expense. Adjustments may now be negative; every other type stays positive.
--
-- wallet_balances (012, and its copy in the API's startup bootstrap) already adds adjustments
-- as +amount, so a negative adjustment lowers the balance without changing the view.
--
-- Idempotent: safe to run more than once.
begin;

alter table transactions drop constraint if exists transactions_amount_positive;
alter table transactions drop constraint if exists transactions_amount_sign;
alter table transactions add constraint transactions_amount_sign check (
  amount > 0 or (type = 'adjustment' and amount <> 0)
);

-- The balance as wallet_balances computes it, counting only transactions up to as_of.
create or replace function wallet_balance_at(target_wallet uuid, as_of timestamptz) returns numeric
language sql stable as $$
  select w.init_balance + coalesce(sum(
    case
      when t.status <> 'approved' then 0
      when t.type in ('income', 'adjustment') and t.wallet_id = w.id then t.amount
      when t.type = 'expense' and t.wallet_id = w.id then -t.amount
      when t.type = 'transfer' and t.wallet_id = w.id then -(t.amount + coalesce(t.admin_fee, 0))
      when t.type = 'transfer' and t.destination_wallet_id = w.id then t.amount
      else 0
    end
  ), 0)
  from wallets w
  left join transactions t
    on (t.wallet_id = w.id or t.destination_wallet_id = w.id)
    and t.user_id = w.user_id
    and t.deleted_at is null
    and t.transaction_at <= as_of
  where w.id = target_wallet
  group by w.id, w.init_balance
$$;

do $$ begin
  create type reconciliation_resolution as enum ('matched', 'adjustment', 'transaction');
exception when duplicate_object then null;
end $$;

-- One row per time the user checked a wallet against reality, also when it already matched.
create table if not exists wallet_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete cascade,
  as_of timestamptz not null,
  actual_balance numeric(18, 2) not null,
  app_balance numeric(18, 2) not null,
  difference numeric(18, 2) not null,
  resolution reconciliation_resolution not null,
  transaction_id uuid references transactions(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint wallet_reconciliations_difference_matches check (difference = actual_balance - app_balance),
  constraint wallet_reconciliations_matched_has_no_difference check ((resolution = 'matched') = (difference = 0))
);

create index if not exists wallet_reconciliations_wallet_idx on wallet_reconciliations(wallet_id, as_of desc);
create index if not exists wallet_reconciliations_user_idx on wallet_reconciliations(user_id);

drop trigger if exists wallet_reconciliations_same_owner on wallet_reconciliations;
create trigger wallet_reconciliations_same_owner
before insert or update on wallet_reconciliations
for each row execute function enforce_same_owner(
  'wallet_id', 'wallets',
  'transaction_id', 'transactions'
);

commit;
