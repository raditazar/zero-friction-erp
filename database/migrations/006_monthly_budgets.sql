-- +goose Up
-- +goose StatementBegin

-- Drop Legacy Tables
DROP TABLE IF EXISTS budget_allocations CASCADE;
DROP TABLE IF EXISTS budget_categories CASCADE;
DROP TABLE IF EXISTS budget_periods CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;

-- Create New Tables
CREATE TABLE monthly_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- YYYY-MM
    planned_income NUMERIC(18,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT monthly_budgets_user_period_key UNIQUE (user_id, period)
);

CREATE INDEX monthly_budgets_user_id_idx ON monthly_budgets(user_id);

CREATE TRIGGER monthly_budgets_set_updated_at
BEFORE UPDATE ON monthly_budgets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE monthly_category_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monthly_budget_id UUID NOT NULL REFERENCES monthly_budgets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT monthly_category_allocations_budget_category_key UNIQUE (monthly_budget_id, category_id),
    CONSTRAINT monthly_category_allocations_allocated_amount_positive CHECK (allocated_amount >= 0)
);

CREATE INDEX monthly_category_allocations_user_id_idx ON monthly_category_allocations(user_id);
CREATE INDEX monthly_category_allocations_monthly_budget_id_idx ON monthly_category_allocations(monthly_budget_id);

CREATE TRIGGER monthly_category_allocations_set_updated_at
BEFORE UPDATE ON monthly_category_allocations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE budget_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- YYYY-MM
    source_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    target_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budget_shifts_amount_positive CHECK (amount > 0)
);

CREATE INDEX budget_shifts_user_id_idx ON budget_shifts(user_id);
CREATE INDEX budget_shifts_user_period_idx ON budget_shifts(user_id, period);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS budget_shifts CASCADE;
DROP TABLE IF EXISTS monthly_category_allocations CASCADE;
DROP TABLE IF EXISTS monthly_budgets CASCADE;
-- +goose StatementEnd
