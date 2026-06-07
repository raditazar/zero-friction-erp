begin;

create extension if not exists pgcrypto;

create type wallet_category as enum (
  'bank',
  'wallet',
  'cash',
  'credit_card',
  'investment',
  'other'
);

create type category_type as enum (
  'income',
  'expense',
  'transfer',
  'adjustment'
);

create type transaction_type as enum (
  'income',
  'expense',
  'transfer',
  'adjustment'
);

create type transaction_status as enum (
  'pending',
  'approved',
  'rejected',
  'needs_review'
);

create type reimbursement_status as enum (
  'none',
  'receivable',
  'partially_reimbursed',
  'reimbursed',
  'ignored'
);

create type input_source as enum (
  'ios',
  'cronjob',
  'api',
  'manual',
  'ai'
);

create type input_mode as enum (
  'manual',
  'text',
  'ocr',
  'screenshot',
  'scheduled'
);

create type webhook_source as enum (
  'ios',
  'cronjob',
  'api'
);

create type webhook_status as enum (
  'received',
  'processed',
  'duplicate',
  'failed'
);

create type dead_letter_status as enum (
  'open',
  'resolved',
  'ignored'
);

create type goal_status as enum (
  'active',
  'paused',
  'completed',
  'cancelled'
);

create type budget_period_type as enum (
  'monthly',
  'weekly',
  'custom'
);

create type allocation_status as enum (
  'planned',
  'allocated',
  'applied',
  'cancelled'
);

create type recurring_rule_status as enum (
  'active',
  'paused',
  'archived'
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint users_email_not_blank check (length(trim(email)) > 0),
  constraint users_email_unique unique (email)
);

create table profiles (
  id uuid primary key references users(id) on delete cascade,
  full_name text,
  phone_number text,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  category wallet_category not null,
  provider text,
  account_number text,
  account_holder text,
  currency char(3) not null default 'IDR',
  init_balance numeric(18, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint wallets_name_not_blank check (length(trim(name)) > 0),
  constraint wallets_currency_uppercase check (currency = upper(currency))
);

create index wallets_user_id_idx on wallets(user_id);
create index wallets_user_active_idx on wallets(user_id, is_active);

create trigger wallets_set_updated_at
before update on wallets
for each row execute function set_updated_at();

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  type category_type not null,
  parent_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint categories_name_not_blank check (length(trim(name)) > 0),
  constraint categories_no_self_parent check (id <> parent_id)
);

create index categories_user_id_idx on categories(user_id);
create index categories_parent_id_idx on categories(parent_id);
create unique index categories_user_name_type_parent_unique_idx
on categories(user_id, name, type, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid))
where deleted_at is null;

create trigger categories_set_updated_at
before update on categories
for each row execute function set_updated_at();

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete restrict,
  destination_wallet_id uuid references wallets(id) on delete restrict,
  type transaction_type not null,
  status transaction_status not null default 'pending',
  transaction_at timestamptz not null,
  merchant text,
  amount numeric(18, 2) not null,
  category_id uuid references categories(id) on delete set null,
  is_reimbursement boolean not null default false,
  reimbursement_status reimbursement_status not null default 'none',
  related_transaction_id uuid references transactions(id) on delete set null,
  note text,
  input_source input_source,
  input_mode input_mode,
  raw_input text,
  ai_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_ai_confidence_range check (
    ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)
  ),
  constraint transactions_transfer_destination_required check (
    (type = 'transfer' and destination_wallet_id is not null)
    or (type <> 'transfer' and destination_wallet_id is null)
  ),
  constraint transactions_transfer_wallets_different check (
    destination_wallet_id is null or wallet_id <> destination_wallet_id
  ),
  constraint transactions_reimbursement_status_consistent check (
    (is_reimbursement = false and reimbursement_status = 'none')
    or (is_reimbursement = true and reimbursement_status <> 'none')
  )
);

create index transactions_user_id_idx on transactions(user_id);
create index transactions_wallet_id_idx on transactions(wallet_id);
create index transactions_destination_wallet_id_idx on transactions(destination_wallet_id);
create index transactions_category_id_idx on transactions(category_id);
create index transactions_user_status_idx on transactions(user_id, status);
create index transactions_user_transaction_at_idx on transactions(user_id, transaction_at desc);
create index transactions_related_transaction_id_idx on transactions(related_transaction_id);

create trigger transactions_set_updated_at
before update on transactions
for each row execute function set_updated_at();

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tags_name_not_blank check (length(trim(name)) > 0)
);

create index tags_user_id_idx on tags(user_id);
create unique index tags_user_name_unique_idx on tags(user_id, name) where deleted_at is null;

create trigger tags_set_updated_at
before update on tags
for each row execute function set_updated_at();

create table transaction_tags (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  deleted_at timestamptz
);

create index transaction_tags_transaction_id_idx on transaction_tags(transaction_id);
create index transaction_tags_tag_id_idx on transaction_tags(tag_id);
create unique index transaction_tags_transaction_tag_unique_idx
on transaction_tags(transaction_id, tag_id)
where deleted_at is null;

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source webhook_source not null,
  idempotency_text text not null,
  payload jsonb not null,
  status webhook_status not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint webhook_events_idempotency_text_not_blank check (length(trim(idempotency_text)) > 0),
  constraint webhook_events_user_idempotency_unique unique (user_id, idempotency_text)
);

create index webhook_events_user_id_idx on webhook_events(user_id);
create index webhook_events_user_status_idx on webhook_events(user_id, status);
create index webhook_events_created_at_idx on webhook_events(created_at desc);

create trigger webhook_events_set_updated_at
before update on webhook_events
for each row execute function set_updated_at();

create table dead_letter_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  webhook_event_id uuid references webhook_events(id) on delete set null,
  raw_payload jsonb not null,
  error_msg text not null,
  status dead_letter_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  deleted_at timestamptz,
  constraint dead_letter_queue_error_msg_not_blank check (length(trim(error_msg)) > 0)
);

create index dead_letter_queue_user_id_idx on dead_letter_queue(user_id);
create index dead_letter_queue_webhook_event_id_idx on dead_letter_queue(webhook_event_id);
create index dead_letter_queue_user_status_idx on dead_letter_queue(user_id, status);

create trigger dead_letter_queue_set_updated_at
before update on dead_letter_queue
for each row execute function set_updated_at();

create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete restrict,
  destination_wallet_id uuid references wallets(id) on delete restrict,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  type transaction_type not null,
  merchant text,
  amount numeric(18, 2) not null,
  currency char(3) not null default 'IDR',
  cron_expression text not null,
  status recurring_rule_status not null default 'active',
  next_run_at timestamptz,
  last_run_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint recurring_rules_name_not_blank check (length(trim(name)) > 0),
  constraint recurring_rules_cron_expression_not_blank check (length(trim(cron_expression)) > 0),
  constraint recurring_rules_amount_positive check (amount > 0),
  constraint recurring_rules_currency_uppercase check (currency = upper(currency)),
  constraint recurring_rules_transfer_destination_required check (
    (type = 'transfer' and destination_wallet_id is not null)
    or (type <> 'transfer' and destination_wallet_id is null)
  ),
  constraint recurring_rules_transfer_wallets_different check (
    destination_wallet_id is null or wallet_id <> destination_wallet_id
  )
);

create index recurring_rules_user_id_idx on recurring_rules(user_id);
create index recurring_rules_user_status_idx on recurring_rules(user_id, status);
create index recurring_rules_next_run_at_idx on recurring_rules(next_run_at) where deleted_at is null and status = 'active';

create trigger recurring_rules_set_updated_at
before update on recurring_rules
for each row execute function set_updated_at();

create table saving_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_id uuid references wallets(id) on delete set null,
  name text not null,
  target_amount numeric(18, 2) not null,
  current_amount numeric(18, 2) not null default 0,
  currency char(3) not null default 'IDR',
  target_date date,
  status goal_status not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint saving_goals_name_not_blank check (length(trim(name)) > 0),
  constraint saving_goals_target_amount_positive check (target_amount > 0),
  constraint saving_goals_current_amount_non_negative check (current_amount >= 0),
  constraint saving_goals_currency_uppercase check (currency = upper(currency))
);

create index saving_goals_user_id_idx on saving_goals(user_id);
create index saving_goals_user_status_idx on saving_goals(user_id, status);

create trigger saving_goals_set_updated_at
before update on saving_goals
for each row execute function set_updated_at();

create table sinking_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  saving_goal_id uuid references saving_goals(id) on delete set null,
  wallet_id uuid references wallets(id) on delete set null,
  name text not null,
  target_amount numeric(18, 2) not null,
  current_amount numeric(18, 2) not null default 0,
  monthly_target numeric(18, 2) not null default 0,
  currency char(3) not null default 'IDR',
  target_date date,
  status goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sinking_funds_name_not_blank check (length(trim(name)) > 0),
  constraint sinking_funds_target_amount_positive check (target_amount > 0),
  constraint sinking_funds_current_amount_non_negative check (current_amount >= 0),
  constraint sinking_funds_monthly_target_non_negative check (monthly_target >= 0),
  constraint sinking_funds_currency_uppercase check (currency = upper(currency))
);

create index sinking_funds_user_id_idx on sinking_funds(user_id);
create index sinking_funds_user_status_idx on sinking_funds(user_id, status);

create trigger sinking_funds_set_updated_at
before update on sinking_funds
for each row execute function set_updated_at();

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  period_type budget_period_type not null default 'monthly',
  currency char(3) not null default 'IDR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint budgets_name_not_blank check (length(trim(name)) > 0),
  constraint budgets_currency_uppercase check (currency = upper(currency))
);

create index budgets_user_id_idx on budgets(user_id);
create index budgets_user_active_idx on budgets(user_id, is_active);

create trigger budgets_set_updated_at
before update on budgets
for each row execute function set_updated_at();

create table budget_periods (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  starts_at date not null,
  ends_at date not null,
  planned_income numeric(18, 2) not null default 0,
  planned_expense numeric(18, 2) not null default 0,
  planned_savings numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint budget_periods_date_order check (starts_at <= ends_at),
  constraint budget_periods_planned_income_non_negative check (planned_income >= 0),
  constraint budget_periods_planned_expense_non_negative check (planned_expense >= 0),
  constraint budget_periods_planned_savings_non_negative check (planned_savings >= 0)
);

create index budget_periods_user_id_idx on budget_periods(user_id);
create index budget_periods_budget_id_idx on budget_periods(budget_id);
create index budget_periods_dates_idx on budget_periods(starts_at, ends_at);

create trigger budget_periods_set_updated_at
before update on budget_periods
for each row execute function set_updated_at();

create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  budget_period_id uuid not null references budget_periods(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  user_id uuid not null references users(id) on delete cascade,
  allocated_amount numeric(18, 2) not null,
  spent_amount numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint budget_categories_allocated_amount_non_negative check (allocated_amount >= 0),
  constraint budget_categories_spent_amount_non_negative check (spent_amount >= 0)
);

create index budget_categories_user_id_idx on budget_categories(user_id);
create index budget_categories_budget_period_id_idx on budget_categories(budget_period_id);
create index budget_categories_category_id_idx on budget_categories(category_id);
create unique index budget_categories_period_category_unique_idx
on budget_categories(budget_period_id, category_id)
where deleted_at is null;

create trigger budget_categories_set_updated_at
before update on budget_categories
for each row execute function set_updated_at();

create table budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  budget_period_id uuid references budget_periods(id) on delete cascade,
  saving_goal_id uuid references saving_goals(id) on delete set null,
  sinking_fund_id uuid references sinking_funds(id) on delete set null,
  wallet_id uuid references wallets(id) on delete set null,
  amount numeric(18, 2) not null,
  status allocation_status not null default 'planned',
  allocated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint budget_allocations_amount_positive check (amount > 0),
  constraint budget_allocations_target_required check (
    saving_goal_id is not null
    or sinking_fund_id is not null
    or wallet_id is not null
  )
);

create index budget_allocations_user_id_idx on budget_allocations(user_id);
create index budget_allocations_budget_period_id_idx on budget_allocations(budget_period_id);
create index budget_allocations_status_idx on budget_allocations(status);

create trigger budget_allocations_set_updated_at
before update on budget_allocations
for each row execute function set_updated_at();

create table income_routing_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  match_category_id uuid references categories(id) on delete set null,
  match_tag_id uuid references tags(id) on delete set null,
  min_amount numeric(18, 2),
  percentage numeric(5, 2) not null,
  destination_wallet_id uuid references wallets(id) on delete set null,
  saving_goal_id uuid references saving_goals(id) on delete set null,
  sinking_fund_id uuid references sinking_funds(id) on delete set null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint income_routing_rules_name_not_blank check (length(trim(name)) > 0),
  constraint income_routing_rules_percentage_range check (percentage > 0 and percentage <= 100),
  constraint income_routing_rules_min_amount_non_negative check (min_amount is null or min_amount >= 0),
  constraint income_routing_rules_destination_required check (
    destination_wallet_id is not null
    or saving_goal_id is not null
    or sinking_fund_id is not null
  )
);

create index income_routing_rules_user_id_idx on income_routing_rules(user_id);
create index income_routing_rules_active_idx on income_routing_rules(user_id, is_active, priority);

create trigger income_routing_rules_set_updated_at
before update on income_routing_rules
for each row execute function set_updated_at();

create table income_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  income_transaction_id uuid not null references transactions(id) on delete cascade,
  routing_rule_id uuid references income_routing_rules(id) on delete set null,
  destination_wallet_id uuid references wallets(id) on delete set null,
  saving_goal_id uuid references saving_goals(id) on delete set null,
  sinking_fund_id uuid references sinking_funds(id) on delete set null,
  amount numeric(18, 2) not null,
  percentage numeric(5, 2),
  status allocation_status not null default 'planned',
  allocated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint income_allocations_amount_positive check (amount > 0),
  constraint income_allocations_percentage_range check (percentage is null or (percentage > 0 and percentage <= 100)),
  constraint income_allocations_destination_required check (
    destination_wallet_id is not null
    or saving_goal_id is not null
    or sinking_fund_id is not null
  )
);

create index income_allocations_user_id_idx on income_allocations(user_id);
create index income_allocations_income_transaction_id_idx on income_allocations(income_transaction_id);
create index income_allocations_status_idx on income_allocations(status);

create trigger income_allocations_set_updated_at
before update on income_allocations
for each row execute function set_updated_at();

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  deleted_at timestamptz,
  constraint api_keys_name_not_blank check (length(trim(name)) > 0),
  constraint api_keys_key_hash_not_blank check (length(trim(key_hash)) > 0),
  constraint api_keys_key_prefix_not_blank check (length(trim(key_prefix)) > 0),
  constraint api_keys_key_hash_unique unique (key_hash)
);

create index api_keys_user_id_idx on api_keys(user_id);
create index api_keys_key_prefix_idx on api_keys(key_prefix);

create trigger api_keys_set_updated_at
before update on api_keys
for each row execute function set_updated_at();

create table webhook_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  token_hash text not null,
  token_prefix text not null,
  source webhook_source not null default 'ios',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  deleted_at timestamptz,
  constraint webhook_tokens_name_not_blank check (length(trim(name)) > 0),
  constraint webhook_tokens_token_hash_not_blank check (length(trim(token_hash)) > 0),
  constraint webhook_tokens_token_prefix_not_blank check (length(trim(token_prefix)) > 0),
  constraint webhook_tokens_token_hash_unique unique (token_hash)
);

create index webhook_tokens_user_id_idx on webhook_tokens(user_id);
create index webhook_tokens_token_prefix_idx on webhook_tokens(token_prefix);

create trigger webhook_tokens_set_updated_at
before update on webhook_tokens
for each row execute function set_updated_at();

create view wallet_balances as
select
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
        when t.type = 'transfer' and t.wallet_id = w.id then -t.amount
        when t.type = 'transfer' and t.destination_wallet_id = w.id then t.amount
        else 0
      end
    ), 0) as curr_balance
from wallets w
left join transactions t
  on (t.wallet_id = w.id or t.destination_wallet_id = w.id)
  and t.deleted_at is null
where w.deleted_at is null
group by w.id;

commit;
