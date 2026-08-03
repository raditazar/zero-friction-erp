"use client";

import { useState, type FormEvent } from "react";
import type { Category, Transaction } from "@/lib/api";
import { amount } from "../formatters";
import { Panel, SelectField, TextInput } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type BudgetCategoryItem = {
  id?: string;
  budget_period_id: string;
  category_id: string;
  allocated_amount: number;
  spent_amount: number;
};

type Props = {
  categories: Category[];
  budgetCategories: BudgetCategoryItem[];
  transactions: Transaction[];
  onSaveAllocation: (categoryId: string, allocatedAmount: number) => Promise<void>;
  onShiftAllocation: (payload: {
    budget_period_id: string;
    from_category_id: string;
    to_category_id: string;
    amount: number;
  }) => Promise<void>;
};

export function BudgetsView({
  categories,
  budgetCategories,
  transactions,
  onSaveAllocation,
  onShiftAllocation,
}: Props) {
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState<Category | null>(null);
  const [donorCategoryId, setDonorCategoryId] = useState("");
  const [shiftAmount, setShiftAmount] = useState("");
  const [shiftBusy, setShiftBusy] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const budgetByCatId = new Map(budgetCategories.map((bc) => [bc.category_id, bc]));

  // Calculate actual spent per category for current month (excluding reimbursements DEC-05)
  const spentByCatId = new Map<string, number>();
  transactions.forEach((t) => {
    if (
      t.status === "approved" &&
      t.type === "expense" &&
      !t.is_reimbursement &&
      t.category_id
    ) {
      const prev = spentByCatId.get(t.category_id) || 0;
      spentByCatId.set(t.category_id, prev + Number(t.amount || 0));
    }
  });

  const totalAllocated = budgetCategories.reduce((acc, bc) => acc + Number(bc.allocated_amount || 0), 0);
  const totalSpent = Array.from(spentByCatId.values()).reduce((acc, val) => acc + val, 0);

  function openShiftModal(category: Category, deficitAmount: number) {
    setTargetCategory(category);
    setShiftAmount(String(deficitAmount));
    const potentialDonors = expenseCategories.filter((c) => {
      if (c.id === category.id) return false;
      const alloc = Number(budgetByCatId.get(c.id)?.allocated_amount || 0);
      const spent = spentByCatId.get(c.id) || 0;
      return alloc - spent > 0;
    });
    setDonorCategoryId(potentialDonors[0]?.id || "");
    setShiftModalOpen(true);
  }

  async function handleShiftSubmit(e: FormEvent) {
    e.preventDefault();
    if (!targetCategory || !donorCategoryId) return;
    const parsedAmount = parseFloat(shiftAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setShiftBusy(true);
    try {
      const budgetPeriodId = budgetCategories[0]?.budget_period_id || "default-period";
      await onShiftAllocation({
        budget_period_id: budgetPeriodId,
        from_category_id: donorCategoryId,
        to_category_id: targetCategory.id,
        amount: parsedAmount,
      });
      setShiftModalOpen(false);
    } catch (err) {
      console.error("Gagal menggeser budget:", err);
    } finally {
      setShiftBusy(false);
    }
  }

  return (
    <InfoTooltipProvider>
      <div className="grid gap-6">
        {/* Metric Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#E8E6E1] bg-[#F9F8F5] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6D7A] uppercase tracking-wider">
              <span>Total Dianggarkan</span>
              <InfoTooltip content="Total alokasi anggaran belanja yang disiapkan bulan ini (DEC-06)." />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[#1A1A1A] tabular-nums">
              {amount(totalAllocated)}
            </p>
          </div>

          <div className="rounded-xl border border-[#E8E6E1] bg-[#F9F8F5] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6D7A] uppercase tracking-wider">
              <span>Total Terpakai</span>
              <InfoTooltip content="Realisasi pengeluaran pribadi disetujui (tidak termasuk reimbursement)." />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[#B91C1C] tabular-nums">
              {amount(totalSpent)}
            </p>
          </div>

          <div className="rounded-xl border border-[#E8E6E1] bg-[#F9F8F5] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6D7A] uppercase tracking-wider">
              <span>Sisa Anggaran Bersih</span>
              <InfoTooltip content="Sisa dana yang aman untuk dibelanjakan sebelum periode berakhir." />
            </div>
            <p
              className={`mt-2 text-3xl font-extrabold tabular-nums ${
                totalAllocated - totalSpent >= 0 ? "text-[#1A1A1A]" : "text-[#B91C1C]"
              }`}
            >
              {amount(totalAllocated - totalSpent)}
            </p>
          </div>
        </div>

        {/* Budget Progress Grid */}
        <Panel className="bg-[#F9F8F5] border border-[#E8E6E1] rounded-xl p-6">
          <div className="panel-head mb-6">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="eyebrow text-[#6E6D7A]">Manajemen Anggaran Per Kategori</p>
                <InfoTooltip content="Standar FinTech YNAB: Tutup defisit di bulan berjalan dari kategori lain yang bersisa agar keuangan tetap seimbang." />
              </div>
              <h3 className="section-title text-[#1A1A1A] text-xl font-bold">
                {expenseCategories.length} Kategori Pengeluaran
              </h3>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {expenseCategories.map((category) => {
              const allocated = Number(budgetByCatId.get(category.id)?.allocated_amount || 0);
              const spent = spentByCatId.get(category.id) || 0;
              const remaining = allocated - spent;
              const isDeficit = remaining < 0;
              const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : spent > 0 ? 100 : 0;

              return (
                <div
                  key={category.id}
                  className="rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-[#1A1A1A]">{category.name}</h4>
                      {isDeficit ? (
                        <Badge variant="danger">
                          Defisit {amount(Math.abs(remaining))}
                        </Badge>
                      ) : (
                        <Badge variant={pct > 85 ? "warning" : "success"}>
                          Sisa {amount(remaining)}
                        </Badge>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs font-medium text-[#6E6D7A] mb-1">
                        <span>Terpakai: {amount(spent)}</span>
                        <span>Target: {amount(allocated)} ({pct}%)</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 pt-3 border-t border-[#F0EEE9]">
                    {isDeficit ? (
                      <button
                        className="btn-danger flex-1 py-2 text-xs font-semibold"
                        onClick={() => openShiftModal(category, Math.abs(remaining))}
                      >
                        ⚡ Tutup Defisit (Shift Budget)
                      </button>
                    ) : (
                      <button
                        className="btn-secondary flex-1 py-2 text-xs font-semibold"
                        onClick={() => {
                          const val = prompt(`Set alokasi anggaran untuk ${category.name} (Rp):`, String(allocated));
                          if (val !== null) {
                            const parsed = parseFloat(val);
                            if (!isNaN(parsed) && parsed >= 0) {
                              onSaveAllocation(category.id, parsed);
                            }
                          }
                        }}
                      >
                        ✏️ Edit Target Budget
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Cover Overspending Modal (1-Click Budget Shift) */}
      {shiftModalOpen && targetCategory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 border border-[#E0DDD6]">
            <div className="flex items-center justify-between border-b border-[#E0DDD6] pb-3">
              <div>
                <p className="eyebrow text-[#6E6D7A]">YNAB Roll With The Punches</p>
                <h3 className="text-lg font-bold text-[#1A1A1A]">Tutup Defisit {targetCategory.name}</h3>
              </div>
              <button className="link-button text-[#6E6D7A]" onClick={() => setShiftModalOpen(false)}>
                Tutup
              </button>
            </div>

            <form className="mt-4 grid gap-4" onSubmit={handleShiftSubmit}>
              <p className="text-xs text-[#6E6D7A]">
                Pindahkan anggaran dari kategori yang bersisa positif untuk menutup defisit pada kategori{" "}
                <span className="font-bold text-[#1A1A1A]">{targetCategory.name}</span>.
              </p>

              <SelectField
                value={donorCategoryId}
                onValueChange={setDonorCategoryId}
                options={expenseCategories.filter((c) => c.id !== targetCategory.id).map((c) => c.id)}
                labels={Object.fromEntries(
                  expenseCategories
                    .filter((c) => c.id !== targetCategory.id)
                    .map((c) => {
                      const alloc = Number(budgetByCatId.get(c.id)?.allocated_amount || 0);
                      const sp = spentByCatId.get(c.id) || 0;
                      return [c.id, `${c.name} (Sisa: ${amount(alloc - sp)})`];
                    })
                )}
                placeholder="Pilih Kategori Donor"
              />

              <TextInput
                label="Nominal Yang Digeser (Rp)"
                value={shiftAmount}
                onChange={setShiftAmount}
                placeholder="Nominal penggeseran..."
                required
              />

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-[#E0DDD6]">
                <button type="button" className="btn-secondary" onClick={() => setShiftModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" disabled={shiftBusy} className="btn-primary">
                  {shiftBusy ? "Memproses..." : "Eksekusi Shift Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </InfoTooltipProvider>
  );
}
