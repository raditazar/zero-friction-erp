"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { BudgetsView } from "@/components/dashboard/views/BudgetsView";
import { api, type Category, type MonthlyBudgetResponse, type ShiftBudgetPayload } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

function BudgetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPeriod = searchParams.get("period");
  const period = rawPeriod || format(new Date(), "yyyy-MM");

  const [categories, setCategories] = useState<Category[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudgetResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawPeriod) {
      router.replace(`?period=${period}`);
      return;
    }
    loadData(period);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, rawPeriod]);

  async function loadData(targetPeriod: string) {
    setBusy(true);
    setError(null);
    try {
      const [catData, budgetData] = await Promise.all([
        api.categories(),
        api.getMonthlyBudget(targetPeriod).catch((err) => {
          if (err.message.includes("404") || err.message.includes("not found")) return null;
          throw err;
        })
      ]);
      setCategories(catData);
      setMonthlyBudget(budgetData);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data anggaran.");
    } finally {
      setBusy(false);
    }
  }

  function handlePeriodChange(newPeriod: string) {
    router.push(`?period=${newPeriod}`);
  }

  async function handleSaveAllocation(categoryId: string, allocatedAmount: number) {
    try {
      await api.upsertBudgetAllocations(period, [{ category_id: categoryId, allocated_amount: allocatedAmount }]);
      await loadData(period);
    } catch (err) {
      console.error("Gagal menyimpan alokasi:", err);
      throw err;
    }
  }

  async function handleShiftAllocation(payload: ShiftBudgetPayload) {
    try {
      await api.shiftBudgetAllocation(payload);
      await loadData(period);
    } catch (err) {
      console.error("Gagal menggeser budget:", err);
      throw err;
    }
  }

  async function handleCopyPrevious() {
    try {
      await api.copyPreviousMonthBudget(period);
      await loadData(period);
    } catch (err) {
      console.error("Gagal menyalin anggaran:", err);
      throw err;
    }
  }

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader />

      {error && (
        <div role="alert" aria-live="polite" className="bg-red-50 text-red-600 p-4 rounded-xl mb-6">
          {error}
        </div>
      )}

      <BudgetsView
        period={period}
        categories={categories}
        monthlyBudget={monthlyBudget}
        loading={busy}
        onPeriodChange={handlePeriodChange}
        onSaveAllocation={handleSaveAllocation}
        onShiftAllocation={handleShiftAllocation}
        onCopyPrevious={handleCopyPrevious}
      />
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <BudgetsPageContent />
    </Suspense>
  );
}
