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
import type { SavingGoal, SinkingFund, Wallet, WalletEnvelope } from "@/lib/api";
import { FundLedgerSheet, type LedgerTarget } from "@/components/dashboard/fund-ledger-sheet";
import type { DraftGoal, DraftFund } from "@/components/dashboard/model";
import { emptyGoal, emptyFund } from "@/components/dashboard/model";
import { Target, PiggyBank, Plus, ArrowDownUp, TriangleAlert } from "lucide-react";
import {
  AppDialog,
  AppDialogBody,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  useMediaQuery,
} from "@/components/ui/dialog";

export type PlanningViewProps = {
  goals: SavingGoal[];
  funds: SinkingFund[];
  wallets: Wallet[];
  /** Per wallet: how much funds and goals hold and what is left to spend. */
  envelopes?: WalletEnvelope[];
  /** Called after a deposit, withdrawal or deleted entry so the lists refresh. */
  onLedgerChanged?: () => void;
  goalDraft: DraftGoal;
  fundDraft: DraftFund;
  setGoalDraft: (draft: DraftGoal) => void;
  setFundDraft: (draft: DraftFund) => void;
  /** Resolves true once saved (closes the phone sheet). */
  onGoalSubmit: (event: FormEvent) => void | Promise<boolean>;
  onFundSubmit: (event: FormEvent) => void | Promise<boolean>;
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
  envelopes = [],
  onLedgerChanged,
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
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [goalSheet, setGoalSheet] = useState(false);
  const [fundSheet, setFundSheet] = useState(false);
  const [ledger, setLedger] = useState<LedgerTarget | null>(null);

  if (loading) return <LoadingState variant="list" rows={4} label="Memuat target" />;
  if (loadError) return <ErrorState title="Target belum bisa dimuat" message={loadError} onRetry={onRetryLoad} />;

  // Wide screens: the form sits beside the list. Phones: list first, form in a bottom sheet.
  const goalForm = (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>{goalDraft.id ? "Ubah target" : "Target baru"}</FormCardTitle>
        <FormCardDescription>Atur dana impian dan pantau progres alokasinya.</FormCardDescription>
      </FormCardHeader>
      <form onSubmit={async (event) => { if ((await onGoalSubmit(event)) === true) setGoalSheet(false); }}>
        <FormCardContent className="space-y-4">
          <FormField label="Nama" required>
            <TextField
              value={goalDraft.name}
              onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })}
              placeholder="misal: Dana Darurat, DP Rumah"
              required
            />
          </FormField>

          <FormField label="Dompet">
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
            <FormField label="Target" required>
              <MoneyField
                value={goalDraft.target_amount}
                onValueChange={(val) => setGoalDraft({ ...goalDraft, target_amount: val })}
                required
              />
            </FormField>
            <FormField label={goalDraft.id ? "Terkumpul" : "Saldo awal"} readOnly={Boolean(goalDraft.id)} hint={goalDraft.id ? "Ubah lewat Setor / Tarik." : undefined}>
              <MoneyField
                value={goalDraft.current_amount}
                onValueChange={(val) => setGoalDraft({ ...goalDraft, current_amount: val })}
              />
            </FormField>
          </ResponsiveFormGrid>

          <ResponsiveFormGrid>
            <FormField label="Tenggat">
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
                <option value="paused">Ditunda</option>
                <option value="completed">Selesai</option>
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
            label={goalDraft.id ? "Simpan" : "Tambah target"}
            busyLabel="Menyimpan..."
          />
        </FormCardFooter>
      </form>
    </FormCard>
  );

  const fundForm = (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>{fundDraft.id ? "Ubah dana cadangan" : "Dana cadangan baru"}</FormCardTitle>
        <FormCardDescription>Persiapkan alokasi dana untuk beban berulang mendatang.</FormCardDescription>
      </FormCardHeader>
      <form onSubmit={async (event) => { if ((await onFundSubmit(event)) === true) setFundSheet(false); }}>
        <FormCardContent className="space-y-4">
          <FormField label="Nama" required>
            <TextField
              value={fundDraft.name}
              onChange={(e) => setFundDraft({ ...fundDraft, name: e.target.value })}
              placeholder="misal: Servis Mobil, Pajak Tahunan"
              required
            />
          </FormField>

          <FormField label="Disisihkan di dompet" hint="Uangnya tetap di dompet ini; saldo tersedia dompet berkurang sebesar isi dana.">
            <NativeSelectField
              value={fundDraft.wallet_id}
              onChange={(e) => setFundDraft({ ...fundDraft, wallet_id: e.target.value })}
            >
              <option value="">Pilih Dompet (Opsional)</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.currency})
                </option>
              ))}
            </NativeSelectField>
          </FormField>

          <FormField label="Untuk target" hint="Opsional">
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
            <FormField label="Target" required>
              <MoneyField
                value={fundDraft.target_amount}
                onValueChange={(val) => setFundDraft({ ...fundDraft, target_amount: val })}
                required
              />
            </FormField>
            <FormField label={fundDraft.id ? "Terkumpul" : "Saldo awal"} readOnly={Boolean(fundDraft.id)} hint={fundDraft.id ? "Ubah lewat Setor / Tarik." : undefined}>
              <MoneyField
                value={fundDraft.current_amount}
                onValueChange={(val) => setFundDraft({ ...fundDraft, current_amount: val })}
              />
            </FormField>
          </ResponsiveFormGrid>

          <ResponsiveFormGrid>
            <FormField label="Disisihkan per bulan">
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
                <option value="paused">Ditunda</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan (Cancelled)</option>
              </NativeSelectField>
            </FormField>
          </ResponsiveFormGrid>

          <FormField label="Tenggat">
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
            label={fundDraft.id ? "Simpan" : "Tambah dana cadangan"}
            busyLabel="Menyimpan..."
          />
        </FormCardFooter>
      </form>
    </FormCard>
  );

  const goalMap = new Map(goals.map((g) => [g.id, g.name]));

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="hidden text-xl font-bold text-ink md:block">Target</h1>
          <p className="hidden text-sm text-ink-soft md:block">Tabungan untuk tujuan dan dana cadangan untuk tagihan besar.</p>
        </div>
        <div className="flex items-center gap-2 surface-inset p-1 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("goals")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "goals"
                ? "surface-raised-sm text-ink"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Target ({goals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("funds")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "funds"
                ? "surface-raised-sm text-ink"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            Dana cadangan ({funds.length})
          </button>
        </div>
      </div>

      <EnvelopeSummary goals={goals} funds={funds} wallets={wallets} envelopes={envelopes} />

      {(submitError || deleteError) && (
        <div className="p-4 rounded-md bg-negative-soft border border-negative-line">
          <p className="text-xs font-medium text-negative">{submitError || deleteError}</p>
        </div>
      )}

      {/* Target Menabung Tab Content */}
      {activeTab === "goals" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {isWide ? <div className="lg:col-span-1">{goalForm}</div> : null}

          <div className="lg:col-span-2 space-y-4">
            {goals.length === 0 ? (
              <EmptyState
                title="Belum ada target"
                description="Buat target pertama, misalnya dana darurat atau liburan."
              />
            ) : (
              goals.map((goal) => {
                const targetNum = Number(goal.target_amount || 0);
                const currNum = Number(goal.current_amount || 0);
                const pct = targetNum > 0 ? Math.min(100, Math.round((currNum / targetNum) * 100)) : 0;

                return (
                  <div
                    key={goal.id}
                    className="surface-raised rounded-xl p-4 space-y-3 transition-colors"
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
                                : "bg-paper-sunk text-ink-soft border border-line"
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
                          onClick={() => setLedger({ kind: "saving-goals", id: goal.id, name: goal.name, walletID: goal.wallet_id, current: currNum })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline"
                        >
                          <ArrowDownUp className="size-3.5" aria-hidden="true" />
                          Setor / Tarik
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onEditGoal(goal);
                            if (!isWide) setGoalSheet(true);
                          }}
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
          {isWide ? <div className="lg:col-span-1">{fundForm}</div> : null}

          <div className="lg:col-span-2 space-y-4">
            {funds.length === 0 ? (
              <EmptyState
                title="Belum ada dana cadangan"
                description="Sisihkan sedikit tiap bulan untuk tagihan besar yang pasti datang."
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
                    className="surface-raised rounded-xl p-4 space-y-3 transition-colors"
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
                          onClick={() => setLedger({ kind: "sinking-funds", id: fund.id, name: fund.name, walletID: fund.wallet_id, current: currNum })}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline"
                        >
                          <ArrowDownUp className="size-3.5" aria-hidden="true" />
                          Setor / Tarik
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onEditFund(fund);
                            if (!isWide) setFundSheet(true);
                          }}
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
      {/* Phones: "Tambah" opens the form in a sheet; editing an item opens the same sheet. */}
      {!isWide ? (
        <div className="grid">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "goals") {
                setGoalDraft(emptyGoal);
                setGoalSheet(true);
              } else {
                setFundDraft(emptyFund);
                setFundSheet(true);
              }
            }}
            className="btn-primary flex items-center justify-center gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            {activeTab === "goals" ? "Tambah target" : "Tambah dana cadangan"}
          </button>
        </div>
      ) : null}
      <FundLedgerSheet target={ledger} wallets={wallets} onClose={() => setLedger(null)} onChanged={() => onLedgerChanged?.()} />
      <AppDialog open={goalSheet && !isWide} onOpenChange={setGoalSheet}>
        <AppDialogContent size="md" className="[&_[data-slot=form-card]]:border-0 [&_[data-slot=form-card]]:shadow-none">
          <AppDialogHeader className="sr-only">
            <AppDialogTitle>{goalDraft.id ? "Ubah target" : "Target baru"}</AppDialogTitle>
          </AppDialogHeader>
          <AppDialogBody className="pt-1">{goalForm}</AppDialogBody>
        </AppDialogContent>
      </AppDialog>
      <AppDialog open={fundSheet && !isWide} onOpenChange={setFundSheet}>
        <AppDialogContent size="md" className="[&_[data-slot=form-card]]:border-0 [&_[data-slot=form-card]]:shadow-none">
          <AppDialogHeader className="sr-only">
            <AppDialogTitle>{fundDraft.id ? "Ubah dana cadangan" : "Dana cadangan baru"}</AppDialogTitle>
          </AppDialogHeader>
          <AppDialogBody className="pt-1">{fundForm}</AppDialogBody>
        </AppDialogContent>
      </AppDialog>
    </div>
  );
}

/** What goals and funds hold in total, and a warning per wallet that holds less than that. */
function EnvelopeSummary({ goals, funds, wallets, envelopes }: { goals: SavingGoal[]; funds: SinkingFund[]; wallets: Wallet[]; envelopes: WalletEnvelope[] }) {
  const live = (status: string) => status !== "cancelled";
  const inGoals = goals.filter((g) => live(g.status)).reduce((t, g) => t + Number(g.current_amount || 0), 0);
  const inFunds = funds.filter((f) => live(f.status)).reduce((t, f) => t + Number(f.current_amount || 0), 0);
  const walletName = new Map(wallets.map((w) => [w.id, w.name]));
  const short = envelopes.filter((e) => e.over_reserved);
  if (inGoals + inFunds === 0 && short.length === 0) return null;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="surface-raised rounded-xl p-3">
          <p className="text-xs text-ink-soft">Di target</p>
          <p className="font-semibold tabular-nums text-ink">{amount(inGoals)}</p>
        </div>
        <div className="surface-raised rounded-xl p-3">
          <p className="text-xs text-ink-soft">Di dana cadangan</p>
          <p className="font-semibold tabular-nums text-ink">{amount(inFunds)}</p>
        </div>
      </div>
      {short.map((e) => (
        <div key={e.wallet_id} role="alert" className="flex items-start gap-2 rounded-md border border-caution-line bg-caution-soft p-3 text-xs text-caution">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Dana di <strong>{walletName.get(e.wallet_id) ?? "dompet"}</strong> ({amount(e.reserved)}) melebihi saldonya ({amount(e.balance)}).
            Tarik sebagian dana atau isi dompet itu.
          </p>
        </div>
      ))}
    </div>
  );
}
