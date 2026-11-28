-- Migration 014: per-user timezone, and transfer admin fees counted as spending.
--
-- 1. profiles.timezone (IANA name, default Asia/Jakarta). The API validates names; day and
--    month boundaries for budgets, analytics and the ledger filter use it.
-- 2. categories.system_key marks categories the app manages. 'admin_fee' is the expense
--    category that transfer admin fees are reported under ("Biaya Admin Bank"); every user
--    gets one, adopting an existing top-level expense category with that name if present.
-- 3. spending_entries: the single definition of "spending" used by budgets and analytics.
--    Expense rows that are not reimbursement claims, plus each transfer's admin_fee as a
--    line in the user's admin fee category. No extra transaction rows are created, so wallet
--    balances (which already subtract admin_fee) are unchanged.
begin;

alter table profiles
  add column if not exists timezone text not null default 'Asia/Jakarta';

alter table categories
  add column if not exists system_key text;

create unique index if not exists categories_user_system_key_idx
  on categories(user_id, system_key)
  where system_key is not null and deleted_at is null;

create or replace function ensure_admin_fee_category(p_user uuid) returns uuid
language plpgsql as $$
declare
  category_id uuid;
begin
  select id into category_id
  from categories
  where user_id = p_user and system_key = 'admin_fee' and deleted_at is null;
  if category_id is not null then
    return category_id;
  end if;

  update categories
  set system_key = 'admin_fee'
  where id = (
    select id from categories
    where user_id = p_user and type = 'expense' and parent_id is null and deleted_at is null
      and lower(name) = 'biaya admin bank'
    limit 1
  )
  returning id into category_id;
  if category_id is not null then
    return category_id;
  end if;

  begin
    insert into categories (user_id, name, type, system_key)
    values (p_user, 'Biaya Admin Bank', 'expense', 'admin_fee')
    returning id into category_id;
  exception when unique_violation then
    -- A concurrent request created it first.
    select id into category_id
    from categories
    where user_id = p_user and system_key = 'admin_fee' and deleted_at is null;
  end;
  return category_id;
end $$;

-- Existing users.
select ensure_admin_fee_category(id) from users;

-- New users, and anyone who deleted the category before recording another fee.
create or replace function users_ensure_admin_fee_category() returns trigger
language plpgsql as $$
begin
  perform ensure_admin_fee_category(new.id);
  return new;
end $$;

drop trigger if exists users_ensure_admin_fee_category on users;
create trigger users_ensure_admin_fee_category
after insert on users
for each row execute function users_ensure_admin_fee_category();

create or replace function transactions_ensure_admin_fee_category() returns trigger
language plpgsql as $$
begin
  if new.type = 'transfer' and coalesce(new.admin_fee, 0) > 0 then
    perform ensure_admin_fee_category(new.user_id);
  end if;
  return new;
end $$;

drop trigger if exists transactions_ensure_admin_fee_category on transactions;
create trigger transactions_ensure_admin_fee_category
after insert or update of type, admin_fee on transactions
for each row execute function transactions_ensure_admin_fee_category();

create or replace view spending_entries as
select
  t.id as transaction_id,
  t.user_id,
  t.category_id,
  t.amount,
  t.transaction_at,
  t.status,
  'expense'::text as source
from transactions t
where t.type = 'expense' and t.is_reimbursement = false and t.deleted_at is null
union all
select
  t.id as transaction_id,
  t.user_id,
  c.id as category_id,
  t.admin_fee as amount,
  t.transaction_at,
  t.status,
  'admin_fee'::text as source
from transactions t
left join categories c
  on c.user_id = t.user_id and c.system_key = 'admin_fee' and c.deleted_at is null
where t.type = 'transfer' and t.admin_fee > 0 and t.deleted_at is null;

commit;
