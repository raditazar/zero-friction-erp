package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	// Disable client-side prepared statement caching for Supabase / PgBouncer pooler compatibility (SQLSTATE 42P05)
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	_ = ensureSchema(ctx, pool)

	return pool, nil
}

func ensureSchema(ctx context.Context, pool *pgxpool.Pool) error {
	statements := []string{
		`DO $$ BEGIN
			CREATE TYPE oauth_provider AS ENUM ('google');
		EXCEPTION WHEN duplicate_object THEN null;
		END $$;`,

		`CREATE TABLE IF NOT EXISTS oauth_accounts (
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
		);`,
		`CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx on oauth_accounts(user_id);`,
		`CREATE INDEX IF NOT EXISTS oauth_accounts_provider_email_idx on oauth_accounts(provider, email);`,

		`CREATE TABLE IF NOT EXISTS auth_sessions (
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
		);`,
		`CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx on auth_sessions(user_id);`,
		`CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx on auth_sessions(expires_at);`,

		`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale text not null default 'id';`,
		`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_format text not null default 'DD/MM/YYYY';`,
		`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_currency text not null default 'IDR';`,

		`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_fee numeric(18, 2) not null default 0;`,

		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS provider_slug text;`,
		`CREATE INDEX IF NOT EXISTS wallets_user_provider_slug_idx ON wallets(user_id, provider_slug);`,

		`CREATE OR REPLACE VIEW wallet_balances AS
		SELECT
			w.id,
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
		FROM wallets w
		LEFT JOIN transactions t
			ON (t.wallet_id = w.id or t.destination_wallet_id = w.id)
			AND t.deleted_at is null
		WHERE w.deleted_at is null
		GROUP BY w.id;`,

		`CREATE TABLE IF NOT EXISTS monthly_budgets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			period VARCHAR(7) NOT NULL,
			planned_income NUMERIC(18,2) NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT monthly_budgets_user_period_key UNIQUE (user_id, period)
		);`,
		`CREATE INDEX IF NOT EXISTS monthly_budgets_user_id_idx ON monthly_budgets(user_id);`,

		`CREATE TABLE IF NOT EXISTS monthly_category_allocations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			monthly_budget_id UUID NOT NULL REFERENCES monthly_budgets(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT monthly_category_allocations_budget_category_key UNIQUE (monthly_budget_id, category_id)
		);`,
		`CREATE INDEX IF NOT EXISTS monthly_category_allocations_user_id_idx ON monthly_category_allocations(user_id);`,
		`CREATE INDEX IF NOT EXISTS monthly_category_allocations_monthly_budget_id_idx ON monthly_category_allocations(monthly_budget_id);`,

		`CREATE TABLE IF NOT EXISTS budget_shifts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			period VARCHAR(7) NOT NULL,
			source_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			target_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			amount NUMERIC(18,2) NOT NULL,
			notes TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS budget_shifts_user_id_idx ON budget_shifts(user_id);`,
		`CREATE INDEX IF NOT EXISTS budget_shifts_user_period_idx ON budget_shifts(user_id, period);`,
	}

	for _, stmt := range statements {
		_, _ = pool.Exec(ctx, stmt)
	}
	return nil
}
