-- Migration 015: scheduled recurring runs.
--
-- Recurring rules now run from a daily cron and catch up on every missed occurrence. Each
-- generated transaction remembers the rule and the occurrence it was made for, and a unique
-- index makes a second run of the same occurrence a no-op (two crons, a cron plus a manual
-- run, or a retry after a timeout cannot double-book a bill). The index also covers
-- soft-deleted rows, so deleting a generated transaction does not make it come back.
--
-- auto_approve: true books the transaction as approved (fixed bills); false puts it in the
-- Inbox as pending (bills whose amount changes, e.g. electricity).
-- last_scheduled_for: the latest occurrence already booked; the next run starts after it.
--
-- Cron times in recurring_rules.cron_expression are wall-clock times in the user's timezone.
-- Idempotent: safe to run more than once.
begin;

alter table recurring_rules
  add column if not exists auto_approve boolean not null default true,
  add column if not exists last_scheduled_for timestamptz;

alter table transactions
  add column if not exists recurring_rule_id uuid references recurring_rules(id) on delete set null,
  add column if not exists scheduled_for timestamptz;

do $$ begin
  alter table transactions
    -- scheduled_for may outlive its rule (on delete set null), not the other way round.
    add constraint transactions_recurring_occurrence_pair check (
      recurring_rule_id is null or scheduled_for is not null
    );
exception when duplicate_object then null;
end $$;

create unique index if not exists transactions_recurring_occurrence_key
  on transactions(recurring_rule_id, scheduled_for)
  where recurring_rule_id is not null;

-- The owner trigger from 012 also checks the rule a transaction points at.
drop trigger if exists transactions_same_owner on transactions;
create trigger transactions_same_owner
before insert or update on transactions
for each row execute function enforce_same_owner(
  'wallet_id', 'wallets',
  'destination_wallet_id', 'wallets',
  'category_id', 'categories',
  'related_transaction_id', 'transactions',
  'duplicate_of_id', 'transactions',
  'recurring_rule_id', 'recurring_rules'
);

-- Finds due rules across all users for the cron.
create index if not exists recurring_rules_due_idx
  on recurring_rules(next_run_at)
  where deleted_at is null and status = 'active';

commit;
