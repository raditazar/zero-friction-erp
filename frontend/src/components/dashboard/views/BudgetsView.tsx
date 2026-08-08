"use client";

import { useState, type FormEvent } from "react";
import type { Category, Transaction } from "@/lib/api";
import { amount } from "../formatters";
import { Panel } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/cards/metric-card";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { MoneyField, FormField, NativeSelectField } from "@/components/ui/form";
import { ReviewDialog, type ReviewItem } from "@/components/ui/dialogs/review-dialog";

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
  // Set Alokasi state
  const [editTargetModalOpen, setEditTargetModalOpen] = useState(false);
  const [targetCategoryForEdit, setTargetCategoryForEdit] = useState<Category | null>(null);
  const [editTargetAmount, setEditTargetAmount] = useState("");
  const [editTargetBusy, setEditTargetBusy] = useState(false);

  // Shift Budget state
  const [shiftFormOpen, setShiftFormOpen] = useState(false);
  const [shiftReviewOpen, setShiftReviewOpen] = useState(false);
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
      spentByCatId.set(t.category_id, prev + parseFloat(String(t.amount || 0)));
    }
  });

  const totalAllocated = budgetCategories.reduce((acc, bc) => acc + parseFloat(String(bc.allocated_amount || 0)), 0);
  const totalSpent = Array.from(spentByCatId.values()).reduce((acc, val) => acc + parseFloat(String(val || 0)), 0);

  // Handlers for Edit Target
  function openEditTargetModal(category: Category, currentAllocation: number) {
    setTargetCategoryForEdit(category);
    setEditTargetAmount(String(currentAllocation));
    setEditTargetModalOpen(true);
  }

  async function handleEditTargetSubmit(e: FormEvent) {
    e.preventDefault();
    if (!targetCategoryForEdit) return;
    const parsed = parseFloat(String(editTargetAmount));
    if (isNaN(parsed) || parsed < 0) return;

    setEditTargetBusy(true);
    try {
      await onSaveAllocation(targetCategoryForEdit.id, parsed);
      setEditTargetModalOpen(false);
    } catch (err) {
      console.error("Gagal menyimpan alokasi:", err);
    } finally {
      setEditTargetBusy(false);
    }
  }

  // Handlers for Shift Budget
  function openShiftModal(category: Category, deficitAmount: number) {
    setTargetCategory(category);
    setShiftAmount(String(deficitAmount));
    const potentialDonors = expenseCategories.filter((c) => {
      if (c.id === category.id) return false;
      const alloc = parseFloat(String(budgetByCatId.get(c.id)?.allocated_amount || 0));
      const spent = spentByCatId.get(c.id) || 0;
      return alloc - spent > 0;
    });
    setDonorCategoryId(potentialDonors[0]?.id || "");
    setShiftFormOpen(true);
  }

  function handleShiftFormSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(String(shiftAmount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!targetCategory || !donorCategoryId) return;
    
    setShiftFormOpen(false);
    setShiftReviewOpen(true);
  }

  async function handleConfirmShift() {
    if (!targetCategory || !donorCategoryId) return;
    const parsedAmount = parseFloat(String(shiftAmount));
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
      setShiftReviewOpen(false);
    } catch (err) {
      console.error("Gagal menggeser budget:", err);
    } finally {
      setShiftBusy(false);
    }
  }

  // Generate Review Items
  const shiftReviewItems: ReviewItem[] = [];
  if (targetCategory && donorCategoryId) {
    const donorCat = expenseCategories.find(c => c.id === donorCategoryId);
    const parsedShiftAmount = parseFloat(String(shiftAmount)) || 0;
    
    if (donorCat) {
      const donorAlloc = parseFloat(String(budgetByCatId.get(donorCat.id)?.allocated_amount || 0));
      shiftReviewItems.push({
        id: "donor",
        label: `Alokasi ${donorCat.name} (Donor)`,
        before: donorAlloc,
        after: donorAlloc - parsedShiftAmount,
      });
    }

    const targetAlloc = parseFloat(String(budgetByCatId.get(targetCategory.id)?.allocated_amount || 0));
    shiftReviewItems.push({
      id: "target",
      label: `Alokasi ${targetCategory.name} (Target)`,
      before: targetAlloc,
      after: targetAlloc + parsedShiftAmount,
    });
  }

  return (
    <InfoTooltipProvider>
      <div className="grid gap-6">
        {/* Metric Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Total Dianggarkan"
            subtitle="Total alokasi anggaran belanja yang disiapkan bulan ini (DEC-06)."
            value={amount(totalAllocated)}
          />
          <MetricCard
            label="Total Terpakai"
            subtitle="Realisasi pengeluaran pribadi disetujui (tidak termasuk reimbursement)."
            value={amount(totalSpent)}
            className="[&_[data-slot=app-card]]:text-[#B91C1C]"
          />
          <MetricCard
            label="Sisa Anggaran Bersih"
            subtitle="Sisa dana yang aman untuk dibelanjakan sebelum periode berakhir."
            value={amount(totalAllocated - totalSpent)}
            className={totalAllocated - totalSpent >= 0 ? "[&_[data-slot=app-card]]:text-[#1A1A1A]" : "[&_[data-slot=app-card]]:text-[#B91C1C]"}
          />
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
              const allocated = parseFloat(String(budgetByCatId.get(category.id)?.allocated_amount || 0));
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
                        onClick={() => openEditTargetModal(category, allocated)}
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

      {/* FormDialog Set Alokasi */}
      <FormDialog
        open={editTargetModalOpen}
        onOpenChange={setEditTargetModalOpen}
        title={`Set Alokasi Anggaran - ${targetCategoryForEdit?.name}`}
        description="Tentukan nominal target pengeluaran untuk kategori ini bulan ini."
        isDirty={parseFloat(String(editTargetAmount)) !== parseFloat(String(budgetByCatId.get(targetCategoryForEdit?.id || "")?.allocated_amount || 0))}
        isSubmitting={editTargetBusy}
        onSubmit={handleEditTargetSubmit}
      >
        <div className="py-4">
          <FormField label="Target Budget (Rp)">
            <MoneyField
              value={editTargetAmount}
              onValueChange={setEditTargetAmount}
              placeholder="0"
              required
            />
          </FormField>
        </div>
      </FormDialog>

      {/* FormDialog Shift Budget Form */}
      <FormDialog
        open={shiftFormOpen}
        onOpenChange={setShiftFormOpen}
        title={`Tutup Defisit ${targetCategory?.name}`}
        description="Pindahkan anggaran dari kategori yang bersisa positif untuk menutup defisit."
        isSubmitting={false}
        submitLabel="Lanjutkan"
        onSubmit={handleShiftFormSubmit}
      >
        <div className="py-4 space-y-4">
          <FormField label="Pilih Kategori Donor">
            <NativeSelectField
              value={donorCategoryId}
              onChange={(e) => setDonorCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>Pilih Kategori Donor</option>
              {expenseCategories
                .filter((c) => c.id !== targetCategory?.id)
                .map((c) => {
                  const alloc = parseFloat(String(budgetByCatId.get(c.id)?.allocated_amount || 0));
                  const sp = spentByCatId.get(c.id) || 0;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} (Sisa: {amount(alloc - sp)})
                    </option>
                  );
                })}
            </NativeSelectField>
          </FormField>

          <FormField label="Nominal Yang Digeser (Rp)">
            <MoneyField
              value={shiftAmount}
              onValueChange={setShiftAmount}
              placeholder="0"
              required
            />
          </FormField>
        </div>
      </FormDialog>

      {/* ReviewDialog Shift Budget Confirm */}
      <ReviewDialog
        open={shiftReviewOpen}
        onOpenChange={setShiftReviewOpen}
        title="Konfirmasi Geser Anggaran"
        description={`Pastikan nominal penggeseran ke ${targetCategory?.name} sudah sesuai.`}
        items={shiftReviewItems}
        onConfirm={handleConfirmShift}
        confirmText={shiftBusy ? "Memproses..." : "Eksekusi Shift Budget"}
      />
    </InfoTooltipProvider>
  );
}
