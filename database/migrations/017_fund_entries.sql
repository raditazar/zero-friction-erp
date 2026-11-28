-- Migration 017: sinking funds and saving goals become virtual envelopes with a ledger.
--
-- The money stays in the wallet; a fund only earmarks part of it. Every change to a fund's
-- amount is a fund_entries row (deposit positive, withdrawal negative), and current_amount is
-- the sum of those rows, kept by triggers so no write path can drift from the ledger:
--   * inserting/updating/deleting an entry recomputes its fund;
--   * a direct write of current_amount (old clients PATCH it) is turned into an adjustment
--     entry for the difference, so the value sticks and the history explains it;
--   * an income allocation with status 'applied' that targets a fund gets exactly one entry,
--     removed again if the allocation is cancelled or deleted.
-- current_amount keeps its >= 0 check, so a withdrawal larger than the fund is rejected.
--
-- Idempotent: safe to run more than once.
begin;

do $$ begin
  create type fund_entry_source as enum ('opening', 'manual', 'withdrawal', 'allocation', 'adjustment');
exception when duplicate_object then null;
end $$;

create table if not exists fund_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  sinking_fund_id uuid references sinking_funds(id) on delete cascade,
  saving_goal_id uuid references saving_goals(id) on delete cascade,
  wallet_id uuid references wallets(id) on delete set null,
  amount numeric(18, 2) not null,
  source fund_entry_source not null default 'manual',
  income_allocation_id uuid references income_allocations(id) on delete cascade,
  note text,
  entry_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fund_entries_amount_not_zero check (amount <> 0),
  constraint fund_entries_one_target check (
    (sinking_fund_id is not null)::int + (saving_goal_id is not null)::int = 1
  )
);

create index if not exists fund_entries_sinking_fund_idx on fund_entries(sinking_fund_id, entry_at desc);
create index if not exists fund_entries_saving_goal_idx on fund_entries(saving_goal_id, entry_at desc);
create index if not exists fund_entries_user_idx on fund_entries(user_id);
create unique index if not exists fund_entries_income_allocation_unique_idx
  on fund_entries(income_allocation_id) where income_allocation_id is not null;

drop trigger if exists fund_entries_same_owner on fund_entries;
create trigger fund_entries_same_owner
before insert or update on fund_entries
for each row execute function enforce_same_owner(
  'sinking_fund_id', 'sinking_funds',
  'saving_goal_id', 'saving_goals',
  'wallet_id', 'wallets',
  'income_allocation_id', 'income_allocations'
);

create or replace function fund_ledger_sum(fund_table text, fund_id uuid) returns numeric
language sql stable as $$
  select coalesce(sum(e.amount), 0)
  from fund_entries e
  where case when fund_table = 'sinking_funds' then e.sinking_fund_id else e.saving_goal_id end = fund_id
$$;

-- Before update on a fund: writes made by the ledger triggers (depth > 1) take the ledger sum;
-- a direct write (depth 1) keeps its value here and is reconciled after the update.
create or replace function funds_pin_current_amount() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then
    new.current_amount := fund_ledger_sum(tg_table_name, new.id);
  end if;
  return new;
end;
$$;

-- After insert or update on a fund: record the gap between current_amount and the ledger.
create or replace function funds_reconcile_ledger() returns trigger
language plpgsql as $$
declare
  gap numeric;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  gap := new.current_amount - fund_ledger_sum(tg_table_name, new.id);
  if gap <> 0 then
    insert into fund_entries (user_id, sinking_fund_id, saving_goal_id, wallet_id, amount, source, note)
    values (
      new.user_id,
      case when tg_table_name = 'sinking_funds' then new.id end,
      case when tg_table_name = 'saving_goals' then new.id end,
      new.wallet_id,
      gap,
      case when tg_op = 'INSERT' then 'opening' else 'adjustment' end::fund_entry_source,
      case when tg_op = 'INSERT' then 'Saldo awal' else 'Penyesuaian saldo' end
    );
  end if;
  return null;
end;
$$;

-- After an entry changes: recompute the fund(s) it touches. The touch-update runs at depth 2,
-- where funds_pin_current_amount sets the ledger sum.
create or replace function fund_entries_recompute() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update sinking_funds set current_amount = current_amount where id = old.sinking_fund_id;
    update saving_goals set current_amount = current_amount where id = old.saving_goal_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update sinking_funds set current_amount = current_amount where id = new.sinking_fund_id;
    update saving_goals set current_amount = current_amount where id = new.saving_goal_id;
  end if;
  return null;
end;
$$;

-- Applied allocations into a fund or goal carry one ledger entry, in the wallet the income
-- landed in. Any other state removes it.
create or replace function income_allocations_sync_fund_entry() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    delete from fund_entries where income_allocation_id = old.id;
    return null;
  end if;

  if new.status = 'applied' and new.deleted_at is null
     and (new.sinking_fund_id is not null or new.saving_goal_id is not null) then
    -- Applied before migration 017: its money is already inside the fund's opening entry.
    if tg_op = 'UPDATE' and old.status = 'applied' and old.deleted_at is null
       and not exists (select 1 from fund_entries where income_allocation_id = new.id) then
      return null;
    end if;
    insert into fund_entries (user_id, sinking_fund_id, saving_goal_id, wallet_id, amount, source, income_allocation_id, note, entry_at)
    select new.user_id,
      new.sinking_fund_id,
      case when new.sinking_fund_id is null then new.saving_goal_id end,
      t.wallet_id, new.amount, 'allocation', new.id, 'Alokasi pemasukan',
      coalesce(new.allocated_at, now())
    from transactions t
    where t.id = new.income_transaction_id
    on conflict (income_allocation_id) where income_allocation_id is not null
    do update set
      amount = excluded.amount,
      sinking_fund_id = excluded.sinking_fund_id,
      saving_goal_id = excluded.saving_goal_id,
      wallet_id = excluded.wallet_id,
      entry_at = excluded.entry_at;
  else
    delete from fund_entries where income_allocation_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists sinking_funds_pin_current_amount on sinking_funds;
create trigger sinking_funds_pin_current_amount
before update on sinking_funds
for each row execute function funds_pin_current_amount();

drop trigger if exists saving_goals_pin_current_amount on saving_goals;
create trigger saving_goals_pin_current_amount
before update on saving_goals
for each row execute function funds_pin_current_amount();

drop trigger if exists sinking_funds_reconcile_ledger on sinking_funds;
create trigger sinking_funds_reconcile_ledger
after insert or update of current_amount on sinking_funds
for each row execute function funds_reconcile_ledger();

drop trigger if exists saving_goals_reconcile_ledger on saving_goals;
create trigger saving_goals_reconcile_ledger
after insert or update of current_amount on saving_goals
for each row execute function funds_reconcile_ledger();

drop trigger if exists fund_entries_recompute on fund_entries;
create trigger fund_entries_recompute
after insert or update or delete on fund_entries
for each row execute function fund_entries_recompute();

drop trigger if exists income_allocations_sync_fund_entry on income_allocations;
create trigger income_allocations_sync_fund_entry
after insert or update or delete on income_allocations
for each row execute function income_allocations_sync_fund_entry();

-- Envelope money per wallet: what live funds and goals hold, and what is left to spend.
create or replace view wallet_envelopes as
with reserved as (
  select wallet_id, sum(current_amount) as amount
  from (
    select wallet_id, current_amount from sinking_funds
    where deleted_at is null and status <> 'cancelled' and wallet_id is not null
    union all
    select wallet_id, current_amount from saving_goals
    where deleted_at is null and status <> 'cancelled' and wallet_id is not null
  ) f
  group by wallet_id
)
select
  wb.id as wallet_id,
  wb.user_id,
  wb.curr_balance as balance,
  coalesce(r.amount, 0) as reserved,
  wb.curr_balance - coalesce(r.amount, 0) as available,
  coalesce(r.amount, 0) > wb.curr_balance as over_reserved
from wallet_balances wb
left join reserved r on r.wallet_id = wb.id;

-- Existing amounts become one opening entry each (current_amount was the only record).
insert into fund_entries (user_id, sinking_fund_id, wallet_id, amount, source, note, entry_at)
select f.user_id, f.id, f.wallet_id, f.current_amount - fund_ledger_sum('sinking_funds', f.id), 'opening', 'Saldo awal', f.created_at
from sinking_funds f
where f.current_amount <> fund_ledger_sum('sinking_funds', f.id);

insert into fund_entries (user_id, saving_goal_id, wallet_id, amount, source, note, entry_at)
select g.user_id, g.id, g.wallet_id, g.current_amount - fund_ledger_sum('saving_goals', g.id), 'opening', 'Saldo awal', g.created_at
from saving_goals g
where g.current_amount <> fund_ledger_sum('saving_goals', g.id);

-- Allocations applied before this migration get no entry: the old API never moved their
-- money into the fund, so whatever the user typed as current_amount already covers them.

commit;
