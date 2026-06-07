begin;

create type oauth_provider as enum (
  'google'
);

create table oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider oauth_provider not null,
  provider_user_id text not null,
  email text not null,
  email_verified boolean not null default false,
  name text,
  avatar_url text,
  access_token_hash text,
  refresh_token_hash text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint oauth_accounts_provider_user_unique unique (provider, provider_user_id),
  constraint oauth_accounts_email_not_blank check (length(trim(email)) > 0)
);

create index oauth_accounts_user_id_idx on oauth_accounts(user_id);
create index oauth_accounts_provider_email_idx on oauth_accounts(provider, email);

create trigger oauth_accounts_set_updated_at
before update on oauth_accounts
for each row execute function set_updated_at();

create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null,
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  deleted_at timestamptz,
  constraint auth_sessions_hash_unique unique (session_hash),
  constraint auth_sessions_hash_not_blank check (length(trim(session_hash)) > 0)
);

create index auth_sessions_user_id_idx on auth_sessions(user_id);
create index auth_sessions_expires_at_idx on auth_sessions(expires_at);

commit;
