-- Migration 012: rows may only reference wallets, categories, tags, transactions, goals,
-- funds and rules that belong to the same user.
--
-- Foreign keys only prove the referenced row exists. Before this migration a request could
-- send another user's wallet_id and the insert succeeded, which changed that user's balance.
-- The check lives in the database so every write path (REST, webhooks, Gmail, Android,
-- recurring runs) is covered, not only the handlers that remember to check.
--
-- Violations raise SQLSTATE ZF403, which the API maps to 400 "referenced resource not found".
-- Idempotent: safe to run more than once.
begin;

-- Trigger arguments come in pairs: <column on the new row>, <referenced table>.
-- Only checks references that are set and that changed (or the row's user_id changed).
create or replace function enforce_same_owner() returns trigger
language plpgsql as $$
declare
  new_row jsonb := to_jsonb(new);
  old_row jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  row_user uuid := (new_row ->> 'user_id')::uuid;
  i int := 0;
  col text;
  ref_table text;
  ref_id text;
  ref_owner uuid;
begin
  while i < tg_nargs loop
    col := tg_argv[i];
    ref_table := tg_argv[i + 1];
    i := i + 2;

    ref_id := new_row ->> col;
    if ref_id is null then
      continue;
    end if;
    if old_row is not null
      and (old_row ->> col) is not distinct from ref_id
      and (old_row ->> 'user_id') is not distinct from (new_row ->> 'user_id') then
      continue;
    end if;

    execute format('select user_id from %I where id = $1', ref_table)
      into ref_owner
      using ref_id::uuid;

    if ref_owner is distinct from row_user then
      raise exception '% does not belong to this user', col
        using errcode = 'ZF403', column = col, table = tg_table_name;
    end if;
  end loop;
  return new;
end;
$$;

-- transaction_tags has no user_id: the tag and the transaction must share an owner.
create or replace function enforce_transaction_tag_owner() returns trigger
language plpgsql as $$
begin
  if (select user_id from transactions where id = new.transaction_id)
     is distinct from (select user_id from tags where id = new.tag_id) then
    raise exception 'tag_id does not belong to this user'
      using errcode = 'ZF403', column = 'tag_id', table = tg_table_name;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_same_owner on transactions;
create trigger transactions_same_owner
before insert or update on transactions
for each row execute function enforce_same_owner(
  'wallet_id', 'wallets',
  'destination_wallet_id', 'wallets',
  'category_id', 'categories',
  'related_transaction_id', 'transactions',
  'duplicate_of_id', 'transactions'
);

drop trigger if exists categories_same_owner on categories;
create trigger categories_same_owner
before insert or update on categories
for each row execute function enforce_same_owner('parent_id', 'categories');

drop trigger if exists transaction_tags_same_owner on transaction_tags;
create trigger transaction_tags_same_owner
before insert or update on transaction_tags
for each row execute function enforce_transaction_tag_owner();

drop trigger if exists recurring_rules_same_owner on recurring_rules;
create trigger recurring_rules_same_owner
before insert or update on recurring_rules
for each row execute function enforce_same_owner(
  'wallet_id', 'wallets',
  'destination_wallet_id', 'wallets',
  'category_id', 'categories'
);

drop trigger if exists saving_goals_same_owner on saving_goals;
create trigger saving_goals_same_owner
before insert or update on saving_goals
for each row execute function enforce_same_owner('wallet_id', 'wallets');

drop trigger if exists sinking_funds_same_owner on sinking_funds;
create trigger sinking_funds_same_owner
before insert or update on sinking_funds
for each row execute function enforce_same_owner(
  'saving_goal_id', 'saving_goals',
  'wallet_id', 'wallets'
);

drop trigger if exists income_routing_rules_same_owner on income_routing_rules;
create trigger income_routing_rules_same_owner
before insert or update on income_routing_rules
for each row execute function enforce_same_owner(
  'match_category_id', 'categories',
  'match_tag_id', 'tags',
  'destination_wallet_id', 'wallets',
  'saving_goal_id', 'saving_goals',
  'sinking_fund_id', 'sinking_funds'
);

drop trigger if exists income_allocations_same_owner on income_allocations;
create trigger income_allocations_same_owner
before insert or update on income_allocations
for each row execute function enforce_same_owner(
  'income_transaction_id', 'transactions',
  'routing_rule_id', 'income_routing_rules',
  'destination_wallet_id', 'wallets',
  'saving_goal_id', 'saving_goals',
  'sinking_fund_id', 'sinking_funds'
);

drop trigger if exists gmail_connections_same_owner on gmail_connections;
create trigger gmail_connections_same_owner
before insert or update on gmail_connections
for each row execute function enforce_same_owner('wallet_id', 'wallets');

-- Created by the API's startup bootstrap on some databases, by 006 on others.
do $$ begin
  if to_regclass('monthly_category_allocations') is not null then
    drop trigger if exists monthly_category_allocations_same_owner on monthly_category_allocations;
    create trigger monthly_category_allocations_same_owner
    before insert or update on monthly_category_allocations
    for each row execute function enforce_same_owner(
      'monthly_budget_id', 'monthly_budgets',
      'category_id', 'categories'
    );
  end if;
  if to_regclass('budget_shifts') is not null then
    drop trigger if exists budget_shifts_same_owner on budget_shifts;
    create trigger budget_shifts_same_owner
    before insert or update on budget_shifts
    for each row execute function enforce_same_owner(
      'source_category_id', 'categories',
      'target_category_id', 'categories'
    );
  end if;
end $$;

-- Balances only count the wallet owner's own transactions.
create or replace view wallet_balances as
select
  w.id,
  w.id as wallet_id,
  w.user_id,
  w.name,
  w.category,
  w.currency,
  w.init_balance
    + coalesce(sum(
      case
        when t.status <> 'approved' then 0
        when t.type in ('income', 'adjustment') and t.wallet_id = w.id then t.amount
        when t.type = 'expense' and t.wallet_id = w.id then -t.amount
        when t.type = 'transfer' and t.wallet_id = w.id then -(t.amount + coalesce(t.admin_fee, 0))
        when t.type = 'transfer' and t.destination_wallet_id = w.id then t.amount
        else 0
      end
    ), 0) as curr_balance
from wallets w
left join transactions t
  on (t.wallet_id = w.id or t.destination_wallet_id = w.id)
  and t.user_id = w.user_id
  and t.deleted_at is null
where w.deleted_at is null
group by w.id;

commit;

-- Read-only check to run after applying: rows written before this migration that point at
-- another user's data. Expected result: zero rows.
--
-- select 'transactions' as tbl, t.id from transactions t
--   join wallets w on w.id in (t.wallet_id, t.destination_wallet_id)
--   where w.user_id <> t.user_id
-- union all
-- select 'transactions.category', t.id from transactions t
--   join categories c on c.id = t.category_id
--   where c.user_id <> t.user_id;
