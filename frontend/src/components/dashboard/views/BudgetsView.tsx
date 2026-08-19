"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, SlidersHorizontal, ArrowLeftRight } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

  // Subcategory Breakdown Accordion state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const parentCategoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const rootExpenseCategories = categories.filter(
    (c) => c.type === "expense" && (!c.parent_id || !parentCategoryMap.has(c.parent_id))
  );

  const allocByCatId = new Map(
    monthlyBudget?.allocations.map((a) => [a.category_id, a])
  );

  const totalAllocated =
    monthlyBudget?.allocations.reduce((acc, a) => acc + parseFloat(String(a.allocated_amount || 0)), 0) || 0;
  const totalSpent =
    monthlyBudget?.allocations.reduce((acc, a) => acc + parseFloat(String(a.spent_amount || 0)), 0) || 0;
  const netRemaining = totalAllocated - totalSpent;
  const overallPct =
    totalAllocated > 0
      ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100))
      : totalSpent > 0
      ? 100
      : 0;

  const selectedDonor = rootExpenseCategories.find((category) => category.id === donorCategoryId);
  const selectedDonorAllocation = selectedDonor ? allocByCatId.get(selectedDonor.id) : undefined;
  const selectedDonorRemaining = selectedDonorAllocation
    ? parseFloat(String(selectedDonorAllocation.allocated_amount)) -
      parseFloat(String(selectedDonorAllocation.spent_amount || 0))
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
    } catch {
      // error handled in page
    } finally {
      setEditTargetBusy(false);
    }
  }

  // Handlers for Shift Budget
  function openShiftModal(category: Category, prefillAmount: number) {
    setShiftError(undefined);
    setTargetCategory(category);
    setShiftAmount(prefillAmount > 0 ? String(prefillAmount) : "");
    const potentialDonors = rootExpenseCategories.filter((c) => {
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
    const donorCat = rootExpenseCategories.find((c) => c.id === donorCategoryId);
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
      <div className="grid gap-6 w-full max-w-full min-w-0">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3.5 w-full min-w-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A]">Anggaran Bulanan</h2>
            <p className="text-xs sm:text-sm text-[#6E6D7A] mt-0.5">Kontrol dan alokasikan rencana pengeluaran bulanan Anda.</p>
          </div>
          <MonthPicker period={period} onChange={onPeriodChange} />
        </div>

        {/* Metric Summary Cards */}
        {!isEmpty && (
          <>
            {/* Mobile Strip Summary (md:hidden) */}
            <div className="md:hidden bg-white border border-[#E8E6E1] rounded-xl p-4 shadow-xs space-y-3.5 w-full min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold tracking-wider text-[#6E6D7A] uppercase">
                  Ringkasan Anggaran
                </span>
                <Badge variant={netRemaining >= 0 ? "success" : "danger"}>
                  {netRemaining >= 0 ? "Aman" : "Over-Budget"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 border-y border-[#F0EEE9] py-3 text-center">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-medium text-[#6E6D7A] uppercase truncate">Dianggarkan</p>
                  <p className="text-xs font-bold text-[#1A1A1A] tabular-nums mt-0.5 truncate">{amount(totalAllocated)}</p>
                </div>
                <div className="min-w-0 border-x border-[#F0EEE9] px-1">
                  <p className="text-[10px] font-mono font-medium text-[#6E6D7A] uppercase truncate">Terpakai</p>
                  <p className="text-xs font-bold text-[#B91C1C] tabular-nums mt-0.5 truncate">{amount(totalSpent)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-medium text-[#6E6D7A] uppercase truncate">Sisa</p>
                  <p
                    className={cn(
                      "text-xs font-bold tabular-nums mt-0.5 truncate",
                      netRemaining >= 0 ? "text-[#059669]" : "text-[#B91C1C]"
                    )}
                  >
                    {amount(netRemaining)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-[#6E6D7A]">
                  <span>Akumulasi Realisasi</span>
                  <span className="font-mono font-semibold text-[#1A1A1A]">{overallPct}%</span>
                </div>
                <Progress value={overallPct} />
              </div>
            </div>

            {/* Desktop Metric Cards (hidden md:grid) */}
            <div className="hidden md:grid gap-4 md:grid-cols-3 w-full min-w-0">
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
                value={amount(netRemaining)}
                className={
                  netRemaining >= 0
                    ? "[&_[data-slot=app-card]]:text-[#1A1A1A]"
                    : "[&_[data-slot=app-card]]:text-[#B91C1C]"
                }
              />
            </div>
          </>
        )}

        {/* Empty State */}
        {isEmpty && !loading && (
          <div className="bg-white rounded-xl border border-dashed border-[#E8E6E1] p-8 text-center shadow-xs w-full min-w-0">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Anggaran Bulan Ini Belum Diatur</h3>
              <p className="text-sm text-[#6E6D7A] mb-6">
                Anda belum mengatur alokasi anggaran untuk periode {period}. Ingin menyalin alokasi dari bulan sebelumnya atau atur satu per satu?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleCopy} disabled={copyBusy} className="btn-primary">
                  {copyBusy ? "Menyalin..." : "Salin Alokasi Bulan Lalu"}
                </Button>
                <Button
                  variant="outline"
                  className="btn-secondary"
                  onClick={() => {
                    setTargetCategoryForEdit(null);
                    setManualCategoryId("");
                    setEditTargetAmount("");
                    setEditTargetModalOpen(true);
                  }}
                >
                  Atur Alokasi Manual
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Budget Progress Grid */}
        {!isEmpty && (
          <Panel className="bg-[#F9F8F5] border border-[#E8E6E1] rounded-xl p-4 sm:p-6 w-full max-w-full min-w-0">
            <div className="panel-head mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full min-w-0">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="eyebrow text-[#6E6D7A]">Manajemen Anggaran Kategori Induk</p>
                  <InfoTooltip content="Alokasi diatur pada tingkat Kategori Induk. Realisasi pengeluaran subkategori otomatis diagregasi ke induknya." />
                </div>
                <h3 className="section-title text-[#1A1A1A] text-lg sm:text-xl font-bold mt-0.5">
                  {rootExpenseCategories.length} Kategori Pengeluaran
                </h3>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant={filterTab === "ALL" ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8 px-3 text-xs font-semibold rounded-lg", filterTab === "ALL" && "btn-primary")}
                  onClick={() => setFilterTab("ALL")}
                >
                  Semua
                </Button>
                <Button
                  variant={filterTab === "DEFICIT" ? "destructive" : "outline"}
                  size="sm"
                  className={cn("h-8 px-3 text-xs font-semibold rounded-lg", filterTab === "DEFICIT" && "bg-[#DC2626] text-white hover:bg-[#B91C1C]")}
                  onClick={() => setFilterTab("DEFICIT")}
                >
                  Over-Budget
                </Button>
                <Button
                  variant={filterTab === "SAFE" ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8 px-3 text-xs font-semibold rounded-lg", filterTab === "SAFE" && "btn-primary")}
                  onClick={() => setFilterTab("SAFE")}
                >
                  Aman
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 w-full max-w-full min-w-0">
              {rootExpenseCategories
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
                  const pct =
                    allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : spent > 0 ? 100 : 0;

                  const subcategories = categories.filter((c) => c.parent_id === category.id);
                  const isExpanded = Boolean(expandedCategories[category.id]);
                  const directParentSpent = monthlyBudget?.category_spent?.[category.id] || 0;

                  return (
                    <div
                      key={category.id}
                      className="rounded-xl border border-[#E8E6E1] bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-shadow hover:shadow-sm min-w-0"
                    >
                      <div>
                        {/* Header Info */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="text-sm sm:text-base font-bold text-[#1A1A1A] truncate">{category.name}</h4>
                            <Badge variant="neutral" className="text-[10px] font-mono shrink-0">
                              Induk
                            </Badge>
                          </div>
                          <div className="shrink-0">
                            {isDeficit ? (
                              <Badge variant="danger">
                                Defisit {amount(Math.abs(remaining))}
                              </Badge>
                            ) : allocated === 0 && spent === 0 ? (
                              <Badge variant="neutral">Belum Diatur</Badge>
                            ) : pct >= 100 ? (
                              <Badge variant="danger">100% Penuh</Badge>
                            ) : (
                              <Badge variant={pct > 80 ? "warning" : "success"}>
                                Sisa {amount(remaining)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar & Spending Info */}
                        <div className="mt-3.5 space-y-1.5">
                          <div className="flex justify-between items-center text-xs text-[#6E6D7A]">
                            <div className="flex items-center gap-1 min-w-0 truncate">
                              <span className="text-[#8E8D9A]">Terpakai:</span>
                              <span className={cn("font-semibold font-mono", isDeficit ? "text-[#B91C1C]" : "text-[#1A1A1A]")}>
                                {amount(spent)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <span className="text-[#8E8D9A]">Target:</span>
                              <span className="font-semibold font-mono text-[#1A1A1A]">{amount(allocated)}</span>
                            </div>
                          </div>
                          <Progress value={pct} />
                          <div className="flex justify-between items-center text-[11px] font-mono text-[#8E8D9A]">
                            <span>Penggunaan</span>
                            <span>{pct}%</span>
                          </div>
                        </div>

                        {/* Expandable Subcategories Breakdown Accordion */}
                        {subcategories.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#F0EEE9]">
                            <button
                              type="button"
                              onClick={() => toggleCategoryExpanded(category.id)}
                              className="flex items-center justify-between w-full py-1 text-xs font-medium text-[#6E6D7A] hover:text-[#1A1A1A] transition-colors focus:outline-none"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <ChevronDown
                                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                                <span className="truncate">
                                  {isExpanded
                                    ? "Sembunyikan Subkategori"
                                    : `Lihat Subkategori (${subcategories.length})`}
                                </span>
                              </span>
                              <span className="text-[11px] text-[#8E8D9A] font-mono shrink-0 ml-2">
                                {subcategories.length} sub
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 space-y-1.5 bg-[#FAF9F5] rounded-lg p-2.5 border border-[#E8E6E1] text-xs animate-in fade-in duration-200">
                                {directParentSpent > 0 && (
                                  <div className="flex items-center justify-between text-[#6E6D7A] py-1 px-2 rounded bg-white/80 border border-[#F0EEE9]">
                                    <span className="flex items-center gap-1.5 font-medium truncate">
                                      <span className="text-[#8E8D9A] font-mono">↳</span>
                                      <span className="truncate">(Langsung ke {category.name})</span>
                                    </span>
                                    <span className="font-semibold text-[#1A1A1A] font-mono shrink-0 ml-2">
                                      {amount(directParentSpent)}
                                    </span>
                                  </div>
                                )}
                                {subcategories.map((sub) => {
                                  const subSpent = monthlyBudget?.category_spent?.[sub.id] || 0;
                                  const subPct = spent > 0 ? Math.round((subSpent / spent) * 100) : 0;
                                  return (
                                    <div
                                      key={sub.id}
                                      className="flex items-center justify-between text-[#6E6D7A] py-1 px-2 rounded hover:bg-white/80 transition-colors"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                                        <span className="text-[#8E8D9A] font-mono">↳</span>
                                        <span className="truncate font-medium text-[#1A1A1A]">
                                          {sub.name}
                                        </span>
                                        {subPct > 0 && (
                                          <span className="text-[10px] text-[#8E8D9A] font-mono shrink-0">
                                            ({subPct}%)
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-semibold text-[#1A1A1A] font-mono ml-2 shrink-0">
                                        {amount(subSpent)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-[#F0EEE9] grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-full flex items-center justify-center gap-1.5 text-xs font-semibold border-[#E8E6E1] bg-white hover:bg-[#FAF9F5] text-[#1A1A1A] transition-colors"
                          onClick={() => openEditTargetModal(category, allocated)}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-[#6E6D7A] shrink-0" />
                          <span className="truncate">Atur Alokasi</span>
                        </Button>
                        <Button
                          variant={isDeficit ? "destructive" : "secondary"}
                          size="sm"
                          className={cn(
                            "h-9 w-full flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors",
                            isDeficit
                              ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
                              : "bg-[#F0EEE9] hover:bg-[#E5E2DC] text-[#1A1A1A] border border-[#E0DDD6]"
                          )}
                          onClick={() => openShiftModal(category, isDeficit ? Math.abs(remaining) : 0)}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Shift Dana</span>
                        </Button>
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
        isDirty={
          parseFloat(String(editTargetAmount)) !==
          parseFloat(String(allocByCatId.get(targetCategoryForEdit?.id || "")?.allocated_amount || 0))
        }
        isSubmitting={editTargetBusy}
        onSubmit={handleEditTargetSubmit}
      >
        <div className="py-4 space-y-4">
          {!targetCategoryForEdit && (
            <FormField label="Pilih Kategori Induk">
              <NativeSelectField
                value={manualCategoryId}
                onChange={(e) => {
                  setManualCategoryId(e.target.value);
                  setTargetCategoryForEdit(rootExpenseCategories.find((c) => c.id === e.target.value) || null);
                }}
                required
              >
                <option value="" disabled>
                  Pilih Kategori
                </option>
                {rootExpenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
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
        title={`Shift Dana ke ${targetCategory?.name || ""}`}
        description="Pindahkan anggaran dari kategori yang bersisa positif untuk menyeimbangkan atau menutup defisit."
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
              <option value="" disabled>
                Pilih Kategori Donor
              </option>
              {rootExpenseCategories
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
