package httpserver

import (
	"testing"
)

// TODO: Implement tests based on the plan
//
// - Test validasi format YYYY-MM (Tolak format invalid).
// - Test GET /budgets dengan perhitungan spent_amount dari transaksi expense.
// - Test POST /budgets/shift (Berhasil saat saldo alokasi sumber mencukupi, Gagal 400 saat sumber defisit/nol).
// - Test POST /budgets/copy-previous (Berhasil menyalin alokasi bulan lalu).

func TestBudgets_GetMonthlyBudget(t *testing.T) {
	t.Skip("Not implemented")
}

func TestBudgets_UpsertAllocations(t *testing.T) {
	t.Skip("Not implemented")
}

func TestBudgets_ShiftFunds(t *testing.T) {
	t.Skip("Not implemented")
}

func TestBudgets_CopyPrevious(t *testing.T) {
	t.Skip("Not implemented")
}
