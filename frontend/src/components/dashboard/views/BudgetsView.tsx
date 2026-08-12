"use client";

import { useState, type FormEvent } from "react";
import type { Category, MonthlyBudgetResponse, ShiftBudgetPayload } from "@/lib/api";
import { amount } from "../formatters";
import { Panel } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/cards/metric-card";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { MoneyField, FormField, NativeSelectField } from "@/components/ui/form";
import { ReviewDialog, type ReviewItem } from "@/components/ui/dialogs/review-dialog";
import { MonthPicker } from "@/components/ui/month-picker";
import { Button } from "@/components/ui/button";

type Props = {
  period: string;
  categories: Category[];
  monthlyBudget: MonthlyBudgetResponse | null;
  loading: boolean;
  onPeriodChange: (newPeriod: string) => void;
  onSaveAllocation: (categoryId: string, allocatedAmount: number) => Promise<void>;
  onShiftAllocation: (payload: ShiftBudgetPayload) => Promise<void>;
  onCopyPrevious: () => Promise<void>;
};

export function BudgetsView({
  period,
  categories,
  monthlyBudget,
  loading,
  onPeriodChange,
  onSaveAllocation,
  onShiftAllocation,
  onCopyPrevious,
}: Props) {
  // Set Alokasi state
  const [editTargetModalOpen, setEditTargetModalOpen] = useState(false);
  const [targetCategoryForEdit, setTargetCategoryForEdit] = useState<Category | null>(null);
  const [manualCategoryId, setManualCategoryId] = useState("");
  const [editTargetAmount, setEditTargetAmount] = useState("");
  const [editTargetBusy, setEditTargetBusy] = useState(false);

  // Shift Budget state
  const [shiftFormOpen, setShiftFormOpen] = useState(false);
  const [shiftReviewOpen, setShiftReviewOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState<Category | null>(null);
  const [donorCategoryId, setDonorCategoryId] = useState("");
  const [shiftAmount, setShiftAmount] = useState("");
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftError, setShiftError] = useState<string | undefined>();
  const [copyBusy, setCopyBusy] = useState(false);

  // Filter Tab state
  const [filterTab, setFilterTab] = useState<"ALL" | "DEFICIT" | "SAFE">("ALL");

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const allocByCatId = new Map(
    monthlyBudget?.allocations.map((a) => [a.category_id, a])
  );

  const totalAllocated = monthlyBudget?.allocations.reduce((acc, a) => acc + parseFloat(String(a.allocated_amount || 0)), 0) || 0;
  const totalSpent = monthlyBudget?.allocations.reduce((acc, a) => acc + parseFloat(String(a.spent_amount || 0)), 0) || 0;
  const selectedDonor = expenseCategories.find((category) => category.id === donorCategoryId);
  const selectedDonorAllocation = selectedDonor ? allocByCatId.get(selectedDonor.id) : undefined;
  const selectedDonorRemaining = selectedDonorAllocation
    ? parseFloat(String(selectedDonorAllocation.allocated_amount)) - parseFloat(String(selectedDonorAllocation.spent_amount || 0))
    : 0;
  const parsedShiftAmount = parseFloat(String(shiftAmount));
  const maximumShift = Math.max(0, selectedDonorRemaining - 1);
  const shiftValidationError = !targetCategory || !selectedDonor
    ? "Pilih kategori sumber dan tujuan."
    : !Number.isFinite(parsedShiftAmount) || parsedShiftAmount <= 0
      ? "Masukkan nominal shift lebih dari Rp0."
      : maximumShift < 1
        ? "Kategori sumber harus menyisakan minimal Rp1 setelah shift."
        : parsedShiftAmount > maximumShift
          ? `Maksimal shift ${amount(maximumShift)} agar sumber tetap menyisakan Rp1.`
          : undefined;

  // Handlers for Edit Target
  function openEditTargetModal(category: Category, currentAllocation: number) {
    setTargetCategoryForEdit(category);
    setManualCategoryId(category.id);
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
      // error handled in page
    } finally {
      setEditTargetBusy(false);
    }
  }

  // Handlers for Shift Budget
  function openShiftModal(category: Category, deficitAmount: number) {
    setShiftError(undefined);
    setTargetCategory(category);
    setShiftAmount(String(deficitAmount));
    const potentialDonors = expenseCategories.filter((c) => {
      if (c.id === category.id) return false;
      const allocData = allocByCatId.get(c.id);
      if (!allocData) return false;
      const alloc = parseFloat(String(allocData.allocated_amount));
      const spent = parseFloat(String(allocData.spent_amount));
      return alloc - spent >= 2;
    });
    setDonorCategoryId(potentialDonors[0]?.id || "");
    setShiftFormOpen(true);
  }

  function handleShiftFormSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(String(shiftAmount));
    if (shiftValidationError) {
      setShiftError(shiftValidationError);
      return;
    }
    
    setShiftFormOpen(false);
    setShiftReviewOpen(true);
  }

  async function handleConfirmShift() {
    if (!targetCategory || !donorCategoryId || shiftValidationError) return;

    setShiftBusy(true);
    try {
      await onShiftAllocation({
        period,
        source_category_id: donorCategoryId,
        target_category_id: targetCategory.id,
        amount: parsedShiftAmount,
      });
      setShiftReviewOpen(false);
    } catch (err) {
      setShiftError(err instanceof Error ? err.message : "Shift dana gagal diproses.");
    } finally {
      setShiftBusy(false);
    }
  }

  async function handleCopy() {
    setCopyBusy(true);
    try {
      await onCopyPrevious();
    } finally {
      setCopyBusy(false);
    }
  }

  // Generate Review Items
  const shiftReviewItems: ReviewItem[] = [];
  if (targetCategory && donorCategoryId) {
    const donorCat = expenseCategories.find(c => c.id === donorCategoryId);
    const reviewAmount = Number.isFinite(parsedShiftAmount) ? parsedShiftAmount : 0;
    
    if (donorCat) {
      const donorAlloc = parseFloat(String(allocByCatId.get(donorCat.id)?.allocated_amount || 0));
      shiftReviewItems.push({
        id: "donor",
        label: `Alokasi ${donorCat.name} (Donor)`,
        before: donorAlloc,
        after: donorAlloc - reviewAmount,
      });
      const donorSpent = parseFloat(String(allocByCatId.get(donorCat.id)?.spent_amount || 0));
      shiftReviewItems.push({
        id: "donor-remaining",
        label: `Sisa ${donorCat.name} (Donor)`,
        before: donorAlloc - donorSpent,
        after: donorAlloc - donorSpent - reviewAmount,
      });
    }

    const targetAlloc = parseFloat(String(allocByCatId.get(targetCategory.id)?.allocated_amount || 0));
    shiftReviewItems.push({
      id: "target",
      label: `Alokasi ${targetCategory.name} (Target)`,
      before: targetAlloc,
      after: targetAlloc + reviewAmount,
    });
    const targetSpent = parseFloat(String(allocByCatId.get(targetCategory.id)?.spent_amount || 0));
    shiftReviewItems.push({
      id: "target-remaining",
      label: `Sisa ${targetCategory.name} (Target)`,
      before: targetAlloc - targetSpent,
      after: targetAlloc - targetSpent + reviewAmount,
    });
  }

  const isEmpty = !monthlyBudget || monthlyBudget.allocations.length === 0;


  return (
    <InfoTooltipProvider>
      <div className="grid gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Anggaran Bulanan</h2>
          <MonthPicker period={period} onChange={onPeriodChange} />
        </div>

        {/* Metric Summary Cards */}
        {!isEmpty && (
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Total Dianggarkan"
              subtitle="Total alokasi anggaran belanja yang disiapkan bulan ini."
              value={amount(totalAllocated)}
            />
            <MetricCard
              label="Total Terpakai"
              subtitle="Realisasi pengeluaran kategori yang dianggarkan."
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
        )}

        {/* Zero-Friction Empty State */}
        {isEmpty && !loading && (
          <div className="bg-white rounded-xl border border-dashed border-[#ccc] p-8 text-center shadow-sm">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Anggaran Bulan Ini Belum Diatur</h3>
              <p className="text-gray-500 mb-6">
                Anda belum mengatur alokasi anggaran untuk periode {period}. Ingin menyalin alokasi dari bulan sebelumnya atau atur satu per satu?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleCopy} disabled={copyBusy} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  {copyBusy ? "Menyalin..." : "Salin Alokasi Bulan Lalu"}
                </Button>
                <Button variant="outline" onClick={() => { setTargetCategoryForEdit(null); setManualCategoryId(""); setEditTargetAmount(""); setEditTargetModalOpen(true); }}>
                  Atur Alokasi Manual
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Budget Progress Grid */}
        {!isEmpty && (
          <Panel className="bg-[#F9F8F5] border border-[#E8E6E1] rounded-xl p-6">
            <div className="panel-head mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="eyebrow text-[#6E6D7A]">Manajemen Anggaran Per Kategori</p>
                  <InfoTooltip content="Tutup defisit di bulan berjalan dari kategori lain yang bersisa agar keuangan tetap seimbang." />
                </div>
                <h3 className="section-title text-[#1A1A1A] text-xl font-bold">
                  {expenseCategories.length} Kategori Pengeluaran
                </h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterTab === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("ALL")}
                >
                  Semua
                </Button>
                <Button
                  variant={filterTab === "DEFICIT" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("DEFICIT")}
                >
                  Over-Budget
                </Button>
                <Button
                  variant={filterTab === "SAFE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("SAFE")}
                  className={filterTab === "SAFE" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                >
                  Aman
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {expenseCategories
                .filter((cat) => {
                  const data = allocByCatId.get(cat.id);
                  const allocated = data ? parseFloat(String(data.allocated_amount)) : 0;
                  const spent = data ? parseFloat(String(data.spent_amount)) : 0;
                  const remaining = allocated - spent;
                  const isDeficit = remaining < 0;
                  if (filterTab === "DEFICIT") return isDeficit;
                  if (filterTab === "SAFE") return !isDeficit && allocated > 0;
                  return true;
                })
                .map((category) => {
                  const data = allocByCatId.get(category.id);
                  const allocated = data ? parseFloat(String(data.allocated_amount)) : 0;
                  const spent = data ? parseFloat(String(data.spent_amount)) : 0;
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
                            <Badge variant={pct > 80 ? "warning" : "success"}>
                              Sisa {amount(remaining)}
                            </Badge>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs font-medium text-[#6E6D7A] mb-1">
                            <span>Terpakai: {amount(spent)}</span>
                            <span>Target: {amount(allocated)}</span>
                          </div>
                          <Progress value={pct} />
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2 pt-3 border-t border-[#F0EEE9]">
                        {isDeficit ? (
                          <Button
                            variant="destructive"
                            className="flex-1 py-2 text-xs font-semibold"
                            onClick={() => openShiftModal(category, Math.abs(remaining))}
                          >
                            Tutup Defisit
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="flex-1 py-2 text-xs font-semibold"
                            onClick={() => openEditTargetModal(category, allocated)}
                          >
                            Edit Target
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </Panel>
        )}
      </div>

      {/* FormDialog Set Alokasi */}
      <FormDialog
        open={editTargetModalOpen}
        onOpenChange={setEditTargetModalOpen}
        title={targetCategoryForEdit ? `Set Alokasi - ${targetCategoryForEdit.name}` : "Set Alokasi"}
        description="Tentukan nominal target pengeluaran untuk kategori ini bulan ini."
        isDirty={parseFloat(String(editTargetAmount)) !== parseFloat(String(allocByCatId.get(targetCategoryForEdit?.id || "")?.allocated_amount || 0))}
        isSubmitting={editTargetBusy}
        onSubmit={handleEditTargetSubmit}
      >
        <div className="py-4 space-y-4">
          {!targetCategoryForEdit && (
            <FormField label="Pilih Kategori">
              <NativeSelectField
                value={manualCategoryId}
                onChange={(e) => {
                  setManualCategoryId(e.target.value);
                  setTargetCategoryForEdit(expenseCategories.find(c => c.id === e.target.value) || null);
                }}
                required
              >
                <option value="" disabled>Pilih Kategori</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelectField>
            </FormField>
          )}
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
        isSubmitDisabled={Boolean(shiftValidationError)}
        submitDisabledReason={shiftValidationError}
        submitError={shiftError}
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
                  const allocData = allocByCatId.get(c.id);
                  if (!allocData) return null;
                  const alloc = parseFloat(String(allocData.allocated_amount));
                  const sp = parseFloat(String(allocData.spent_amount));
                  if (alloc - sp < 2) return null;
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
        isConfirming={shiftBusy}
        submitError={shiftError}
      />
    </InfoTooltipProvider>
  );
}
