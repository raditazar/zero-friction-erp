-- Migration 016: reimbursement claims can be paid in parts.
--
-- A claim is an expense with is_reimbursement = true. Money coming back for it is an income
-- transaction whose related_transaction_id points at the claim, so one claim can have many
-- payments. Before this migration the link went the other way (claim -> one income) and the
-- status was set by hand, so a 100k claim paid 60k could only be "reimbursed" or not.
--
-- reimbursement_status on the claim is now derived and kept in sync by a trigger:
--   ignored                 set by the user, never overwritten
--   reimbursed              payments cover the claim, or the user closed it by hand
--                           (reimbursement_settled_at, e.g. paid back outside the app)
--   partially_reimbursed    some approved payment, less than the claim
--   receivable              nothing received yet
--
-- Idempotent: safe to run more than once.
begin;

alter table transactions
  add column if not exists reimbursement_settled_at timestamptz;

create index if not exists transactions_reimbursement_claims_idx
  on transactions(user_id)
  where is_reimbursement = true and deleted_at is null;

-- Approved, live income rows that pay back the given claim.
create or replace function reimbursement_received(claim_id uuid) returns numeric
language sql stable as $$
  select coalesce(sum(p.amount), 0)
  from transactions p
  where p.related_transaction_id = claim_id
    and p.type = 'income'
    and p.status = 'approved'
    and p.deleted_at is null
$$;

create or replace function refresh_reimbursement_status(claim_id uuid) returns void
language plpgsql as $$
declare
  c transactions%rowtype;
  received numeric;
  next_status reimbursement_status;
begin
  if claim_id is null then
    return;
  end if;
  select * into c from transactions where id = claim_id;
  if not found or not c.is_reimbursement or c.reimbursement_status = 'ignored' then
    return;
  end if;

  received := reimbursement_received(claim_id);
  next_status := case
    when c.reimbursement_settled_at is not null or received >= c.amount then 'reimbursed'
    when received > 0 then 'partially_reimbursed'
    else 'receivable'
  end;

  if next_status is distinct from c.reimbursement_status then
    update transactions set reimbursement_status = next_status where id = claim_id;
  end if;
end;
$$;

-- Recompute the claims a row change can affect: the claim a payment points at (before and
-- after the change), and the row itself when it is a claim.
create or replace function transactions_sync_reimbursement() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.type = 'income' and old.related_transaction_id is not null then
    perform refresh_reimbursement_status(old.related_transaction_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.type = 'income' and new.related_transaction_id is not null
      and (tg_op = 'INSERT' or new.related_transaction_id is distinct from old.related_transaction_id
           or new.amount is distinct from old.amount or new.status is distinct from old.status
           or new.deleted_at is distinct from old.deleted_at or new.type is distinct from old.type) then
      perform refresh_reimbursement_status(new.related_transaction_id);
    end if;

    -- Any direct write to a claim (a PATCH may send a stale status) is recomputed. The
    -- refresh's own update runs at depth 2 and is skipped, so this cannot loop.
    if new.is_reimbursement and (tg_op = 'INSERT' or pg_trigger_depth() = 1) then
      perform refresh_reimbursement_status(new.id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists transactions_sync_reimbursement on transactions;
create trigger transactions_sync_reimbursement
after insert or update or delete on transactions
for each row execute function transactions_sync_reimbursement();

-- True when an income row is money coming back for a claim. Such income is not personal
-- income: the claim's expense is already left out of spending, so counting the payment
-- would inflate income instead of cancelling out.
create or replace function is_reimbursement_payment(related_id uuid) returns boolean
language sql stable as $$
  select related_id is not null and exists (
    select 1 from transactions c where c.id = related_id and c.is_reimbursement
  )
$$;

-- Claims with what has come back so far.
create or replace view reimbursement_claims as
select
  c.id,
  c.user_id,
  c.amount as claimed,
  reimbursement_received(c.id) as received,
  case
    when c.reimbursement_status in ('reimbursed', 'ignored') then 0
    else greatest(c.amount - reimbursement_received(c.id), 0)
  end as outstanding,
  c.reimbursement_status as status,
  c.reimbursement_settled_at as settled_at
from transactions c
where c.is_reimbursement = true and c.deleted_at is null;

-- Claims already marked reimbursed stay closed, whatever payments are linked to them. Runs
-- before the link flip below, whose trigger would otherwise recompute them from payments.
update transactions
set reimbursement_settled_at = coalesce(updated_at, now())
where is_reimbursement = true
  and reimbursement_status = 'reimbursed'
  and reimbursement_settled_at is null;

-- Move old links (claim -> income) to the new direction (income -> claim), only when the
-- income is the user's own, still free, and not itself a claim.
update transactions p
set related_transaction_id = c.id
from transactions c
where c.is_reimbursement = true
  and c.related_transaction_id = p.id
  and p.user_id = c.user_id
  and p.type = 'income'
  and p.related_transaction_id is null;

update transactions c
set related_transaction_id = null
from transactions p
where c.is_reimbursement = true
  and c.related_transaction_id = p.id
  and p.related_transaction_id = c.id;

select refresh_reimbursement_status(id)
from transactions
where is_reimbursement = true and deleted_at is null;

commit;
