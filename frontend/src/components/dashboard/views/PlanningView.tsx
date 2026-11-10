"use client";

import React, { useState, type FormEvent } from "react";
import {
  FormCard,
  FormCardHeader,
  FormCardTitle,
  FormCardDescription,
  FormCardContent,
  FormCardFooter,
  FormField,
  ResponsiveFormGrid,
  TextField,
  MoneyField,
  DateField,
  NativeSelectField,
  TextareaField,
  SubmitAction,
} from "@/components/ui/form";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/feedback";
import { amount } from "@/components/dashboard/formatters";
import type { SavingGoal, SinkingFund, Wallet } from "@/lib/api";
import type { DraftGoal, DraftFund } from "@/components/dashboard/model";
import { emptyGoal, emptyFund } from "@/components/dashboard/model";
import { Target, PiggyBank } from "lucide-react";

export type PlanningViewProps = {
  goals: SavingGoal[];
  funds: SinkingFund[];
  wallets: Wallet[];
  goalDraft: DraftGoal;
  fundDraft: DraftFund;
  setGoalDraft: (draft: DraftGoal) => void;
  setFundDraft: (draft: DraftFund) => void;
  onGoalSubmit: (event: FormEvent) => void;
  onFundSubmit: (event: FormEvent) => void;
  onEditGoal: (goal: SavingGoal) => void;
  onEditFund: (fund: SinkingFund) => void;
  onDeleteGoal: (goal: SavingGoal) => void;
  onDeleteFund: (fund: SinkingFund) => void;
  loading?: boolean;
  loadError?: string;
  onRetryLoad?: () => void;
  goalSubmitBusy?: boolean;
  fundSubmitBusy?: boolean;
  submitError?: string;
  deleteError?: string;
};

export function PlanningView({
  goals,
  funds,
  wallets,
  goalDraft,
  fundDraft,
  setGoalDraft,
  setFundDraft,
  onGoalSubmit,
  onFundSubmit,
  onEditGoal,
  onEditFund,
  onDeleteGoal,
  onDeleteFund,
  loading = false,
  loadError = "",
  onRetryLoad,
  goalSubmitBusy = false,
  fundSubmitBusy = false,
  submitError = "",
  deleteError = "",
}: PlanningViewProps) {
  const [activeTab, setActiveTab] = useState<"goals" | "funds">("goals");

  if (loading) return <LoadingState label="Memuat data perencanaan..." />;
  if (loadError) return <ErrorState title="Gagal Memuat Perencanaan" message={loadError} onRetry={onRetryLoad} />;

  const goalMap = new Map(goals.map((g) => [g.id, g.name]));

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Perencanaan Keuangan</h1>
          <p className="text-xs text-ink-soft">Kelola target menabung dan sinking fund untuk masa depan Anda.</p>
        </div>
        <div className="flex items-center gap-2 bg-paper-sunk p-1 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("goals")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "goals"
                ? "bg-card text-ink shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Target Menabung ({goals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("funds")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "funds"
                ? "bg-card text-ink shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            Sinking Fund ({funds.length})
          </button>
        </div>
      </div>

      {(submitError || deleteError) && (
        <div className="p-4 rounded-md bg-negative-soft border border-negative-line">
          <p className="text-xs font-medium text-negative">{submitError || deleteError}</p>
        </div>
      )}

      {/* Target Menabung Tab Content */}
      {activeTab === "goals" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <FormCard>
              <FormCardHeader>
                <FormCardTitle>{goalDraft.id ? "Edit Target Menabung" : "Target Menabung Baru"}</FormCardTitle>
                <FormCardDescription>Atur dana impian dan pantau progres alokasinya.</FormCardDescription>
              </FormCardHeader>
              <form onSubmit={onGoalSubmit}>
                <FormCardContent className="space-y-4">
                  <FormField label="Nama Target" required>
                    <TextField
                      value={goalDraft.name}
                      onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })}
                      placeholder="misal: Dana Darurat, DP Rumah"
                      required
                    />
                  </FormField>

                  <FormField label="Dompet Sumber/Alokasi">
                    <NativeSelectField
                      value={goalDraft.wallet_id}
                      onChange={(e) => setGoalDraft({ ...goalDraft, wallet_id: e.target.value })}
                    >
                      <option value="">Pilih Dompet (Opsional)</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.currency})
                        </option>
                      ))}
                    </NativeSelectField>
                  </FormField>

                  <ResponsiveFormGrid>
                    <FormField label="Target Nominal (Rp)" required>
                      <MoneyField
                        value={goalDraft.target_amount}
                        onValueChange={(val) => setGoalDraft({ ...goalDraft, target_amount: val })}
                        required
                      />
                    </FormField>
                    <FormField label="Terkumpul Saat Ini (Rp)">
                      <MoneyField
                        value={goalDraft.current_amount}
                        onValueChange={(val) => setGoalDraft({ ...goalDraft, current_amount: val })}
                      />
                    </FormField>
                  </ResponsiveFormGrid>

                  <ResponsiveFormGrid>
                    <FormField label="Tenggat Waktu">
                      <DateField
                        value={goalDraft.target_date}
                        onChange={(e) => setGoalDraft({ ...goalDraft, target_date: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Status">
                      <NativeSelectField
                        value={goalDraft.status}
                        onChange={(e) => setGoalDraft({ ...goalDraft, status: e.target.value })}
                      >
                        <option value="active">Aktif</option>
                        <option value="paused">Ditunda (Paused)</option>
                        <option value="completed">Selesai (Completed)</option>
                        <option value="cancelled">Dibatalkan (Cancelled)</option>
                      </NativeSelectField>
                    </FormField>
                  </ResponsiveFormGrid>

                  <FormField label="Catatan">
                    <TextareaField
                      value={goalDraft.note}
                      onChange={(e) => setGoalDraft({ ...goalDraft, note: e.target.value })}
                      placeholder="Catatan tujuan atau strategi menabung..."
                      rows={2}
                    />
                  </FormField>
                </FormCardContent>
                <FormCardFooter>
                  {goalDraft.id && (
                    <button
                      type="button"
                      onClick={() => setGoalDraft(emptyGoal)}
                      className="px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
                    >
                      Batal
                    </button>
                  )}
                  <SubmitAction
                    isSubmitting={goalSubmitBusy}
                    label={goalDraft.id ? "Perbarui Target" : "Tambah Target"}
                    busyLabel="Menyimpan..."
                  />
                </FormCardFooter>
              </form>
            </FormCard>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {goals.length === 0 ? (
              <EmptyState
                title="Belum Ada Target Menabung"
                description="Buat target menabung pertama Anda menggunakan form di samping."
              />
            ) : (
              goals.map((goal) => {
                const targetNum = Number(goal.target_amount || 0);
                const currNum = Number(goal.current_amount || 0);
                const pct = targetNum > 0 ? Math.min(100, Math.round((currNum / targetNum) * 100)) : 0;

                return (
                  <div
                    key={goal.id}
                    className="bg-card rounded-xl border border-line p-4 space-y-3 shadow-sm hover:border-line-strong transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-ink text-base">{goal.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                              goal.status === "active"
                                ? "bg-positive-soft text-positive border border-positive-line"
                                : goal.status === "completed"
                                ? "bg-info-soft text-info border border-info-line"
                                : "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]"
                            }`}
                          >
                            {goal.status}
                          </span>
                        </div>
                        {goal.target_date && (
                          <p className="text-xs text-ink-soft mt-0.5">
                            Tenggat: <span className="font-medium text-ink">{goal.target_date}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => onEditGoal(goal)}
                          className="text-xs font-semibold text-info hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteGoal(goal)}
                          className="text-xs font-semibold text-negative hover:underline"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono tabular-nums">
                        <span className="text-ink-soft">
                          Terkumpul: <strong className="text-ink">{amount(currNum)}</strong>
                        </span>
                        <span className="text-ink-soft">
                          Target: <strong className="text-ink">{amount(targetNum)}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-paper-sunk h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-info-solid h-full transition-all duration-300 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {goal.note && <p className="text-xs text-ink-soft italic">{goal.note}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sinking Fund Tab Content */}
      {activeTab === "funds" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <FormCard>
              <FormCardHeader>
                <FormCardTitle>{fundDraft.id ? "Edit Sinking Fund" : "Sinking Fund Baru"}</FormCardTitle>
                <FormCardDescription>Persiapkan alokasi dana untuk beban berulang mendatang.</FormCardDescription>
              </FormCardHeader>
              <form onSubmit={onFundSubmit}>
                <FormCardContent className="space-y-4">
                  <FormField label="Nama Sinking Fund" required>
                    <TextField
                      value={fundDraft.name}
                      onChange={(e) => setFundDraft({ ...fundDraft, name: e.target.value })}
                      placeholder="misal: Servis Mobil, Pajak Tahunan"
                      required
                    />
                  </FormField>

                  <FormField label="Tautkan ke Target (Opsional)">
                    <NativeSelectField
                      value={fundDraft.saving_goal_id}
                      onChange={(e) => setFundDraft({ ...fundDraft, saving_goal_id: e.target.value })}
                    >
                      <option value="">Tidak Ditautkan</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </NativeSelectField>
                  </FormField>

                  <ResponsiveFormGrid>
                    <FormField label="Target Nominal (Rp)" required>
                      <MoneyField
                        value={fundDraft.target_amount}
                        onValueChange={(val) => setFundDraft({ ...fundDraft, target_amount: val })}
                        required
                      />
                    </FormField>
                    <FormField label="Terkumpul (Rp)">
                      <MoneyField
                        value={fundDraft.current_amount}
                        onValueChange={(val) => setFundDraft({ ...fundDraft, current_amount: val })}
                      />
                    </FormField>
                  </ResponsiveFormGrid>

                  <ResponsiveFormGrid>
                    <FormField label="Target Bulanan (Rp)">
                      <MoneyField
                        value={fundDraft.monthly_target}
                        onValueChange={(val) => setFundDraft({ ...fundDraft, monthly_target: val })}
                      />
                    </FormField>
                    <FormField label="Status">
                      <NativeSelectField
                        value={fundDraft.status}
                        onChange={(e) => setFundDraft({ ...fundDraft, status: e.target.value })}
                      >
                        <option value="active">Aktif</option>
                        <option value="paused">Ditunda (Paused)</option>
                        <option value="completed">Selesai (Completed)</option>
                        <option value="cancelled">Dibatalkan (Cancelled)</option>
                      </NativeSelectField>
                    </FormField>
                  </ResponsiveFormGrid>

                  <FormField label="Tenggat Waktu">
                    <DateField
                      value={fundDraft.target_date}
                      onChange={(e) => setFundDraft({ ...fundDraft, target_date: e.target.value })}
                    />
                  </FormField>
                </FormCardContent>
                <FormCardFooter>
                  {fundDraft.id && (
                    <button
                      type="button"
                      onClick={() => setFundDraft(emptyFund)}
                      className="px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
                    >
                      Batal
                    </button>
                  )}
                  <SubmitAction
                    isSubmitting={fundSubmitBusy}
                    label={fundDraft.id ? "Perbarui Sinking Fund" : "Tambah Sinking Fund"}
                    busyLabel="Menyimpan..."
                  />
                </FormCardFooter>
              </form>
            </FormCard>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {funds.length === 0 ? (
              <EmptyState
                title="Belum Ada Sinking Fund"
                description="Buat sinking fund pertama Anda untuk mengalokasikan pengeluaran berkala."
              />
            ) : (
              funds.map((fund) => {
                const targetNum = Number(fund.target_amount || 0);
                const currNum = Number(fund.current_amount || 0);
                const monthlyNum = Number(fund.monthly_target || 0);
                const pct = targetNum > 0 ? Math.min(100, Math.round((currNum / targetNum) * 100)) : 0;
                const linkedGoalName = fund.saving_goal_id ? goalMap.get(fund.saving_goal_id) : null;

                return (
                  <div
                    key={fund.id}
                    className="bg-card rounded-xl border border-line p-4 space-y-3 shadow-sm hover:border-line-strong transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-ink text-base">{fund.name}</h3>
                          {linkedGoalName && (
                            <span className="bg-paper-sunk text-ink-soft text-xs font-medium px-2 py-0.5 rounded">
                              Target: {linkedGoalName}
                            </span>
                          )}
                        </div>
                        {fund.target_date && (
                          <p className="text-xs text-ink-soft mt-0.5">
                            Tenggat: <span className="font-medium text-ink">{fund.target_date}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => onEditFund(fund)}
                          className="text-xs font-semibold text-info hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFund(fund)}
                          className="text-xs font-semibold text-negative hover:underline"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono tabular-nums">
                        <span className="text-ink-soft">
                          Terkumpul: <strong className="text-ink">{amount(currNum)}</strong>
                          {monthlyNum > 0 && ` (Setoran: ${amount(monthlyNum)}/bln)`}
                        </span>
                        <span className="text-ink-soft">
                          Target: <strong className="text-ink">{amount(targetNum)}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-paper-sunk h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-positive-solid h-full transition-all duration-300 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
