"use client";

import { useEffect, useState } from "react";
import { BudgetsView } from "@/components/dashboard/views/BudgetsView";
import { api, type Category, type Transaction } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";


export default function BudgetsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [budgetCategories, setBudgetCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([api.categories(), api.budgetCategories(), api.transactions()])
      .then(([catData, bCatData, txData]) => {
        setCategories(catData);
        setBudgetCategories(bCatData);
        setTransactions(txData.data);
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  async function handleSaveAllocation(categoryId: string, allocatedAmount: number) {
    setBusy(true);
    try {
      const existing = budgetCategories.find((bc) => bc.category_id === categoryId);
      if (existing) {
        await api.patchBudgetCategory(existing.id, { allocated_amount: allocatedAmount });
      } else {
        const periodId = budgetCategories[0]?.budget_period_id || "default-period";
        await api.createBudgetCategory({
          budget_period_id: periodId,
          category_id: categoryId,
          allocated_amount: allocatedAmount,
        });
      }
      loadData();
    } catch (err) {
      console.error("Gagal menyimpan alokasi anggaran:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleShiftAllocation(payload: {
    budget_period_id: string;
    from_category_id: string;
    to_category_id: string;
    amount: number;
  }) {
    setBusy(true);
    try {
      await api.shiftBudgetAllocation(payload);
      loadData();
    } catch (err) {
      console.error("Gagal menggeser budget:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader />
      <BudgetsView
        categories={categories}
        budgetCategories={budgetCategories}
        transactions={transactions}
        onSaveAllocation={handleSaveAllocation}
        onShiftAllocation={handleShiftAllocation}
      />
    </div>
  );
}
