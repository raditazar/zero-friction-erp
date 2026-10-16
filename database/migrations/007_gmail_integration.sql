begin;

create table gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  email text not null,
  refresh_token_ciphertext text,
  wallet_id uuid references wallets(id) on delete restrict,
  recipient_account_ciphertext text,
  enabled boolean not null default false,
  test_mode boolean not null default false,
  activated_at timestamptz,
  history_id text,
  page_token text,
  recovery_history_id text,
  watch_expires_at timestamptz,
  lease_id text,
  lease_until timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gmail_enabled_config check (not enabled or
    (refresh_token_ciphertext is not null and wallet_id is not null and recipient_account_ciphertext is not null and activated_at is not null))
);

create table gmail_oauth_states (
  state_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table gmail_messages (
  connection_id uuid not null references gmail_connections(id) on delete cascade,
  message_id text not null,
  status text not null check (status in ('imported', 'failed', 'ignored')),
  error_code text,
  transaction_id uuid references transactions(id) on delete restrict,
  received_at timestamptz,
  processed_at timestamptz not null default now(),
  primary key (connection_id, message_id)
);

-- Schema is installed explicitly, never by the best-effort startup bootstrap.
commit;
