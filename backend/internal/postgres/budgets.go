package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MonthlyBudget struct {
	ID            string               `json:"id"`
	UserID        string               `json:"user_id"`
	Period        string               `json:"period"`
	PlannedIncome float64              `json:"planned_income"`
	Notes         *string              `json:"notes"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
	Allocations   []CategoryAllocation `json:"allocations"`
	CategorySpent map[string]float64   `json:"category_spent,omitempty"`
}

type CategoryAllocation struct {
	ID              string    `json:"id"`
	MonthlyBudgetID string    `json:"monthly_budget_id"`
	UserID          string    `json:"user_id"`
	CategoryID      string    `json:"category_id"`
	AllocatedAmount float64   `json:"allocated_amount"`
	SpentAmount     float64   `json:"spent_amount"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type BudgetShift struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	Period           string    `json:"period"`
	SourceCategoryID string    `json:"source_category_id"`
	TargetCategoryID string    `json:"target_category_id"`
	Amount           float64   `json:"amount"`
	Notes            *string   `json:"notes"`
	CreatedAt        time.Time `json:"created_at"`
}

type BudgetRepository struct {
	pool *pgxpool.Pool
}

func NewBudgetRepository(pool *pgxpool.Pool) *BudgetRepository {
	return &BudgetRepository{pool: pool}
}

// GetMonthlyBudget retrieves the monthly budget with allocations and real-time spent_amount
func (r *BudgetRepository) GetMonthlyBudget(ctx context.Context, userID, period string) (*MonthlyBudget, error) {
	queryBudget := `
		SELECT id, user_id, period, planned_income, notes, created_at, updated_at
		FROM monthly_budgets
		WHERE user_id = $1 AND period = $2
	`
	budget := &MonthlyBudget{}
	err := r.pool.QueryRow(ctx, queryBudget, userID, period).Scan(
		&budget.ID, &budget.UserID, &budget.Period, &budget.PlannedIncome,
		&budget.Notes, &budget.CreatedAt, &budget.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // Return nil if budget doesn't exist
		}
		return nil, fmt.Errorf("query budget: %w", err)
	}

	querySpent := `
		SELECT t.category_id, COALESCE(SUM(t.amount), 0)
		FROM transactions t
		WHERE t.user_id = $1
		  AND t.type = 'expense'
		  AND t.status = 'approved'
		  AND t.is_reimbursement = false
		  AND to_char(t.transaction_at, 'YYYY-MM') = $2
		  AND t.deleted_at IS NULL
		  AND t.category_id IS NOT NULL
		GROUP BY t.category_id
	`
	spentRows, err := r.pool.Query(ctx, querySpent, userID, period)
	if err != nil {
		return nil, fmt.Errorf("query category spent: %w", err)
	}
	defer spentRows.Close()

	categorySpent := make(map[string]float64)
	for spentRows.Next() {
		var catID string
		var spent float64
		if err := spentRows.Scan(&catID, &spent); err != nil {
			return nil, fmt.Errorf("scan category spent: %w", err)
		}
		categorySpent[catID] = spent
	}
	if err := spentRows.Err(); err != nil {
		return nil, fmt.Errorf("category spent rows iteration: %w", err)
	}
	budget.CategorySpent = categorySpent

	queryAllocations := `
		SELECT 
			a.id, a.monthly_budget_id, a.user_id, a.category_id, a.allocated_amount, 
			COALESCE((
				SELECT SUM(t.amount)
				FROM transactions t
				LEFT JOIN categories c ON t.category_id = c.id
				WHERE t.user_id = $1
				  AND t.type = 'expense'
				  AND t.status = 'approved'
				  AND t.is_reimbursement = false
				  AND to_char(t.transaction_at, 'YYYY-MM') = $2
				  AND t.deleted_at IS NULL
				  AND (t.category_id = a.category_id OR c.parent_id = a.category_id)
			), 0) as spent_amount,
			a.created_at, a.updated_at
		FROM monthly_category_allocations a
		WHERE a.monthly_budget_id = $3
	`
	rows, err := r.pool.Query(ctx, queryAllocations, userID, period, budget.ID)
	if err != nil {
		return nil, fmt.Errorf("query allocations: %w", err)
	}
	defer rows.Close()

	var allocations []CategoryAllocation
	for rows.Next() {
		var a CategoryAllocation
		if err := rows.Scan(
			&a.ID, &a.MonthlyBudgetID, &a.UserID, &a.CategoryID, &a.AllocatedAmount,
			&a.SpentAmount, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan allocation: %w", err)
		}
		allocations = append(allocations, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}
	budget.Allocations = allocations

	return budget, nil
}

func (r *BudgetRepository) UpsertAllocations(ctx context.Context, userID, period string, allocations []CategoryAllocation) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var budgetID string
	queryBudget := `
		INSERT INTO monthly_budgets (user_id, period)
		VALUES ($1, $2)
		ON CONFLICT (user_id, period) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`
	err = tx.QueryRow(ctx, queryBudget, userID, period).Scan(&budgetID)
	if err != nil {
		return fmt.Errorf("upsert budget: %w", err)
	}

	for _, a := range allocations {
		queryAlloc := `
			INSERT INTO monthly_category_allocations (monthly_budget_id, user_id, category_id, allocated_amount)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (monthly_budget_id, category_id) DO UPDATE 
			SET allocated_amount = EXCLUDED.allocated_amount, updated_at = NOW()
		`
		_, err = tx.Exec(ctx, queryAlloc, budgetID, userID, a.CategoryID, a.AllocatedAmount)
		if err != nil {
			return fmt.Errorf("upsert allocation: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (r *BudgetRepository) ShiftFundsAtomic(ctx context.Context, userID, period, sourceCatID, targetCatID string, amount float64, notes *string) error {
	if amount <= 0 || sourceCatID == targetCatID {
		return fmt.Errorf("shift amount must be greater than 0")
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var budgetID string
	err = tx.QueryRow(ctx, `SELECT id FROM monthly_budgets WHERE user_id = $1 AND period = $2 FOR UPDATE`, userID, period).Scan(&budgetID)
	if err != nil {
		return fmt.Errorf("budget not found: %w", err)
	}

	var sourceAlloc float64
	err = tx.QueryRow(ctx, `
		SELECT allocated_amount 
		FROM monthly_category_allocations 
		WHERE monthly_budget_id = $1 AND category_id = $2 FOR UPDATE
	`, budgetID, sourceCatID).Scan(&sourceAlloc)
	if err != nil {
		return fmt.Errorf("source allocation not found: %w", err)
	}

	var sourceSpent float64
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1 AND category_id = $2 AND type = 'expense'
		  AND to_char(transaction_at at time zone 'UTC', 'YYYY-MM') = $3 AND deleted_at IS NULL
	`, userID, sourceCatID, period).Scan(&sourceSpent)
	if err != nil {
		return fmt.Errorf("calculate source spending: %w", err)
	}
	if sourceAlloc-sourceSpent-amount < 1 {
		return fmt.Errorf("source category must retain at least Rp1 after shift")
	}

	var targetExists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1 AND user_id = $2 AND type = 'expense' AND deleted_at IS NULL)
	`, targetCatID, userID).Scan(&targetExists)
	if err != nil || !targetExists {
		return fmt.Errorf("target expense category not found")
	}

	_, err = tx.Exec(ctx, `
		UPDATE monthly_category_allocations 
		SET allocated_amount = allocated_amount - $1, updated_at = NOW()
		WHERE monthly_budget_id = $2 AND category_id = $3
	`, amount, budgetID, sourceCatID)
	if err != nil {
		return fmt.Errorf("deduct source: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO monthly_category_allocations (monthly_budget_id, user_id, category_id, allocated_amount)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (monthly_budget_id, category_id) DO UPDATE 
		SET allocated_amount = monthly_category_allocations.allocated_amount + EXCLUDED.allocated_amount, updated_at = NOW()
	`, budgetID, userID, targetCatID, amount)
	if err != nil {
		return fmt.Errorf("add target: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO budget_shifts (user_id, period, source_category_id, target_category_id, amount, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, userID, period, sourceCatID, targetCatID, amount, notes)
	if err != nil {
		return fmt.Errorf("record shift: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *BudgetRepository) CopyPreviousMonthAllocations(ctx context.Context, userID, targetPeriod string) error {
	t, err := time.Parse("2006-01", targetPeriod)
	if err != nil {
		return fmt.Errorf("invalid period format: %w", err)
	}
	prevPeriod := t.AddDate(0, -1, 0).Format("2006-01")

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var prevBudgetID string
	err = tx.QueryRow(ctx, `SELECT id FROM monthly_budgets WHERE user_id = $1 AND period = $2`, userID, prevPeriod).Scan(&prevBudgetID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("previous budget not found")
		}
		return fmt.Errorf("get prev budget: %w", err)
	}

	var targetBudgetID string
	err = tx.QueryRow(ctx, `
		INSERT INTO monthly_budgets (user_id, period)
		VALUES ($1, $2)
		ON CONFLICT (user_id, period) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, userID, targetPeriod).Scan(&targetBudgetID)
	if err != nil {
		return fmt.Errorf("upsert target budget: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO monthly_category_allocations (monthly_budget_id, user_id, category_id, allocated_amount)
		SELECT $1, user_id, category_id, allocated_amount
		FROM monthly_category_allocations
		WHERE monthly_budget_id = $2
		ON CONFLICT (monthly_budget_id, category_id) DO NOTHING
	`, targetBudgetID, prevBudgetID)
	if err != nil {
		return fmt.Errorf("copy allocations: %w", err)
	}

	return tx.Commit(ctx)
}
