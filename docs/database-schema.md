# Database Schema Draft

Draft ini menargetkan Supabase PostgreSQL. Prinsip utamanya:

- `auth.users` menjadi sumber identitas login.
- `profiles` menyimpan data profil user.
- `wallets` menyimpan rekening, bank, e-wallet, cash, dan sumber dana lain.
- `transactions` menjadi ledger utama untuk transaksi masuk, keluar, transfer, dan koreksi saldo.
- Saldo wallet dihitung dari `opening_balance + transactions`, bukan disimpan sebagai sumber kebenaran utama di tabel wallet.
- Semua data utama memiliki `user_id` agar siap memakai Row-Level Security.

## Entity Overview

```text
auth.users
  -> profiles
  -> wallets
  -> categories
  -> tags
  -> transactions
       -> transaction_tags
  -> webhook_events
       -> dead_letter_queue
```

## Recommended Types

```sql
create type wallet_type as enum (
  'bank',
  'ewallet',
  'cash',
  'credit_card',
  'investment',
  'other'
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

create type input_mode as enum (
  'manual',
  'automatic'
);

create type input_source as enum (
  'manual',
  'ios_shortcut_text',
  'ios_shortcut_ocr',
  'ios_shortcut_screenshot',
  'cron',
  'api',
  'ai'
);

create type reimbursement_status as enum (
  'none',
  'receivable',
  'partially_reimbursed',
  'reimbursed',
  'ignored'
);

create type webhook_event_status as enum (
  'received',
  'processed',
  'duplicate',
  'failed'
);

create type dlq_status as enum (
  'open',
  'resolved',
  'ignored'
);
```

## Tables

### profiles

Menyimpan profil aplikasi untuk setiap user Supabase.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  display_name text,
  phone_number text,
  avatar_url text,
  locale text not null default 'id-ID',
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### wallets

Menyimpan rekening, bank, e-wallet, cash, dan instrumen keuangan lain.

`opening_balance` adalah saldo awal saat wallet mulai dicatat di sistem. `current_balance` sebaiknya tidak disimpan di sini sebagai sumber kebenaran. Jika butuh performa, gunakan view/materialized view/snapshot.

```sql
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type wallet_type not null,
  provider text,
  account_number text,
  account_holder_name text,
  currency text not null default 'IDR',
  opening_balance numeric(18, 2) not null default 0,
  opening_balance_at timestamptz not null default now(),
  color text,
  icon text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_name_not_blank check (length(trim(name)) > 0),
  constraint wallets_currency_uppercase check (currency = upper(currency))
);

create index wallets_user_id_idx on wallets(user_id);
create index wallets_user_active_idx on wallets(user_id, is_active);
```

Catatan keamanan: untuk produksi, `account_number` bisa diganti menjadi `account_number_last4` dan `account_number_encrypted` jika full nomor rekening perlu disimpan.

### categories

Kategori utama transaksi. Mendukung parent category agar bisa dibuat bertingkat.

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type transaction_type not null,
  parent_id uuid references categories(id) on delete set null,
  color text,
  icon text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(trim(name)) > 0),
  constraint categories_no_self_parent check (id <> parent_id)
);

create index categories_user_id_idx on categories(user_id);
create index categories_user_type_idx on categories(user_id, type);
```

### tags

Tag dipakai untuk konteks multi-dimensi seperti proyek, organisasi, event, reimbursement, atau personal/business.

```sql
create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_not_blank check (length(trim(name)) > 0),
  constraint tags_user_name_unique unique (user_id, name)
);

create index tags_user_id_idx on tags(user_id);
```

### transactions

Ledger utama. Transaksi masuk dan keluar digabung di tabel ini melalui kolom `type`.

Aturan nominal:

- `amount` selalu positif.
- `type = 'expense'` berarti mengurangi saldo `wallet_id`.
- `type = 'income'` berarti menambah saldo `wallet_id`.
- `type = 'transfer'` berarti mengurangi `wallet_id` dan menambah `destination_wallet_id`.
- `type = 'adjustment'` dipakai untuk koreksi saldo manual.

```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete restrict,
  destination_wallet_id uuid references wallets(id) on delete restrict,
  category_id uuid references categories(id) on delete set null,
  related_transaction_id uuid references transactions(id) on delete set null,

  type transaction_type not null,
  status transaction_status not null default 'pending',

  transaction_at timestamptz not null,
  merchant text,
  amount numeric(18, 2) not null,
  currency text not null default 'IDR',

  is_reimbursement boolean not null default false,
  reimbursement_status reimbursement_status not null default 'none',

  note text,
  input_mode input_mode not null default 'manual',
  input_source input_source not null default 'manual',
  raw_input text,
  raw_payload jsonb,
  ai_confidence numeric(5, 4),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_currency_uppercase check (currency = upper(currency)),
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
create index transactions_user_status_idx on transactions(user_id, status);
create index transactions_user_type_idx on transactions(user_id, type);
create index transactions_user_transaction_at_idx on transactions(user_id, transaction_at desc);
create index transactions_wallet_id_idx on transactions(wallet_id);
create index transactions_category_id_idx on transactions(category_id);
create index transactions_related_transaction_id_idx on transactions(related_transaction_id);
```

### transaction_tags

Many-to-many antara transaksi dan tag.

```sql
create table transaction_tags (
  transaction_id uuid not null references transactions(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (transaction_id, tag_id)
);

create index transaction_tags_tag_id_idx on transaction_tags(tag_id);
```

### webhook_events

Menyimpan semua request otomatis dari iOS Shortcuts, cron, atau API. Tabel ini penting untuk idempotency dan audit.

```sql
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source input_source not null,
  idempotency_key text not null,
  payload jsonb not null,
  status webhook_event_status not null default 'received',
  transaction_id uuid references transactions(id) on delete set null,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint webhook_events_user_idempotency_unique unique (user_id, idempotency_key)
);

create index webhook_events_user_id_idx on webhook_events(user_id);
create index webhook_events_user_status_idx on webhook_events(user_id, status);
create index webhook_events_received_at_idx on webhook_events(received_at desc);
```

### dead_letter_queue

Tempat karantina untuk input otomatis yang gagal diproses, misalnya OCR buruk, JSON AI invalid, atau data penting tidak lengkap.

```sql
create table dead_letter_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  webhook_event_id uuid references webhook_events(id) on delete set null,
  raw_payload jsonb not null,
  error_message text not null,
  status dlq_status not null default 'open',
  resolution_note text,
  resolved_transaction_id uuid references transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index dead_letter_queue_user_id_idx on dead_letter_queue(user_id);
create index dead_letter_queue_user_status_idx on dead_letter_queue(user_id, status);
```

### recurring_rules

Opsional untuk transaksi rutin seperti gaji, server, subscription, atau cicilan.

```sql
create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete restrict,
  category_id uuid references categories(id) on delete set null,
  type transaction_type not null,
  name text not null,
  merchant text,
  amount numeric(18, 2) not null,
  currency text not null default 'IDR',
  cron_expression text not null,
  next_run_at timestamptz,
  last_run_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_rules_amount_positive check (amount > 0),
  constraint recurring_rules_no_transfer check (type in ('income', 'expense', 'adjustment'))
);

create index recurring_rules_user_id_idx on recurring_rules(user_id);
create index recurring_rules_next_run_at_idx on recurring_rules(next_run_at) where is_active = true;
```

### wallet_balance_snapshots

Opsional untuk audit/performa. Tidak wajib untuk MVP, tetapi berguna jika jumlah transaksi sudah besar.

```sql
create table wallet_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete cascade,
  balance numeric(18, 2) not null,
  calculated_until timestamptz not null,
  created_at timestamptz not null default now(),
  constraint wallet_balance_snapshots_unique unique (wallet_id, calculated_until)
);

create index wallet_balance_snapshots_user_wallet_idx on wallet_balance_snapshots(user_id, wallet_id);
```

## Balance View

View ini menghitung saldo wallet dari saldo awal dan transaksi berstatus `approved`.

```sql
create view wallet_balances as
select
  w.id as wallet_id,
  w.user_id,
  w.name,
  w.type,
  w.currency,
  w.opening_balance
    + coalesce(sum(
      case
        when t.status <> 'approved' then 0
        when t.type in ('income', 'adjustment') and t.wallet_id = w.id then t.amount
        when t.type = 'expense' and t.wallet_id = w.id then -t.amount
        when t.type = 'transfer' and t.wallet_id = w.id then -t.amount
        when t.type = 'transfer' and t.destination_wallet_id = w.id then t.amount
        else 0
      end
    ), 0) as current_balance
from wallets w
left join transactions t
  on t.wallet_id = w.id
  or t.destination_wallet_id = w.id
group by w.id;
```

## MVP Table Priority

Untuk MVP, implementasikan dulu:

1. `profiles`
2. `wallets`
3. `categories`
4. `tags`
5. `transactions`
6. `transaction_tags`
7. `webhook_events`
8. `dead_letter_queue`
9. `wallet_balances` view

`recurring_rules` dan `wallet_balance_snapshots` bisa masuk setelah alur transaksi harian stabil.

## Suggested Seed Data

Kategori awal:

```text
Expense: Food & Beverage, Transport, Bills, Shopping, Health, Education, Donation, Other
Income: Salary, Freelance, Gift, Reimbursement, Investment Return, Other
Transfer: Wallet Transfer
Adjustment: Balance Correction
```

Tag awal:

```text
Personal, Work, Organization, Project, Reimbursement
```

Wallet awal:

```text
Cash, Main Bank, E-Wallet
```

## RLS Direction

Semua tabel yang memiliki `user_id` sebaiknya memakai rule:

```sql
user_id = auth.uid()
```

Untuk `profiles`, rule-nya:

```sql
id = auth.uid()
```

