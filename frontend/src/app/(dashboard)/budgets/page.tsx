"use client";

import { useEffect, Suspense } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { BudgetsView } from "@/components/dashboard/views/BudgetsView";
import { api, type Category, type MonthlyBudgetResponse, type ShiftBudgetPayload } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

import { toast } from "@/components/ui/toast";
import { KEYS } from "@/lib/swr";

const EMPTY_CATEGORIES: Category[] = [];

function BudgetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPeriod = searchParams.get("period");
  const period = rawPeriod || format(new Date(), "yyyy-MM");

  const { data, error: loadError, isLoading, mutate } = useSWR(
    rawPeriod ? KEYS.budget(period) : null,
    async () => {
      const [categories, monthlyBudget] = await Promise.all([
        api.categories(),
        api.getMonthlyBudget(period).catch((err) => {
          if (err.message.includes("404") || err.message.includes("not found")) return null;
          throw err;
        }),
      ]);
      return { categories, monthlyBudget };
    },
  );
  const categories = data?.categories ?? EMPTY_CATEGORIES;
  const monthlyBudget: MonthlyBudgetResponse | null = data?.monthlyBudget ?? null;
  const busy = isLoading;
  const error = loadError && !data ? "Gagal memuat data anggaran." : null;

  useEffect(() => {
    if (!rawPeriod) router.replace(`?period=${period}`);
  }, [period, rawPeriod, router]);

  async function loadData() {
    await mutate();
  }

  function handlePeriodChange(newPeriod: string) {
    router.push(`?period=${newPeriod}`);
  }

  async function handleSaveAllocation(categoryId: string, allocatedAmount: number) {
    try {
      await api.upsertBudgetAllocations(period, [{ category_id: categoryId, allocated_amount: allocatedAmount }]);
      toast.success("Alokasi anggaran berhasil diperbarui.");
      await loadData();
    } catch (err) {
      console.error("Gagal menyimpan alokasi:", err);
      const msg = err instanceof Error ? err.message : "Gagal memperbarui alokasi anggaran.";
      toast.error("Gagal memperbarui alokasi anggaran", { detail: msg });
      throw err;
    }
  }

  async function handleShiftAllocation(payload: ShiftBudgetPayload) {
    try {
      await api.shiftBudgetAllocation(payload);
      toast.success("Anggaran berhasil digeser.");
      await loadData();
    } catch (err) {
      console.error("Gagal menggeser budget:", err);
      const msg = err instanceof Error ? err.message : "Gagal menggeser anggaran.";
      toast.error("Gagal menggeser anggaran", { detail: msg });
      throw err;
    }
  }

  async function handleCopyPrevious() {
    try {
      await api.copyPreviousMonthBudget(period);
      toast.success("Anggaran bulan sebelumnya berhasil disalin.");
      await loadData();
    } catch (err) {
      console.error("Gagal menyalin anggaran:", err);
      const msg = err instanceof Error ? err.message : "Gagal menyalin anggaran bulan sebelumnya.";
      toast.error("Gagal menyalin anggaran", { detail: msg });
      throw err;
    }
  }

  return (
    <div className="p-3 sm:p-6 bg-[#F7F6F2] min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
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
    <Suspense fallback={<div className="p-3 sm:p-6 bg-[#F7F6F2] min-h-screen w-full max-w-full overflow-x-hidden min-w-0">Loading...</div>}>
      <BudgetsPageContent />
    </Suspense>
  );
}
