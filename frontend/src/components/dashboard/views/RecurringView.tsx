import type { FormEvent } from "react";
import type { Category, RecurringRule, Wallet } from "@/lib/api";
import type { DraftRecurringRule } from "../model";
import { transactionTypes } from "../model";
import { amount, dateLabel } from "../formatters";
import { FormField, MoneyField, NativeSelectField, ResponsiveFormGrid, TextField, TextareaField, TimeField } from "@/components/ui/form";
import { MetricCard, ListCard, ListCardItem } from "@/components/ui/cards";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { Activity, Pause, TrendingDown, Plus, Pencil, Trash2 } from "lucide-react";

const intervals = ["daily", "weekly", "monthly"];
const recurringStatuses = ["active", "paused", "archived"];
const weekdays = ["0", "1", "2", "3", "4", "5", "6"];
const weekdayLabels: Record<string, string> = {
  "0": "Minggu",
  "1": "Senin",
  "2": "Selasa",
  "3": "Rabu",
  "4": "Kamis",
  "5": "Jumat",
  "6": "Sabtu",
};
const intervalLabels: Record<string, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };
const statusLabels: Record<string, string> = { active: "Aktif", paused: "Dijeda", archived: "Diarsipkan" };
const typeLabels: Record<string, string> = { expense: "Pengeluaran", income: "Pemasukan", transfer: "Transfer", adjustment: "Penyesuaian" };

export function RecurringView({
  rules,
  wallets,
  categories,
  draft,
  setDraft,
  onSubmit,
  onEdit,
  onDelete,
  isFormOpen,
  setIsFormOpen,
  isSubmitting,
  loading = false,
  loadError = "",
  onRetry,
}: {
  rules: RecurringRule[];
  wallets: Wallet[];
  categories: Category[];
  draft: DraftRecurringRule;
  setDraft: (draft: DraftRecurringRule) => void;
  onSubmit: (event: FormEvent) => void;
  onEdit: (rule: RecurringRule) => void;
  onDelete: (id: string) => void;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  isSubmitting?: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
}) {
  const categoryOptions = categories.filter((category) => category.type === draft.type);

  const activeRulesCount = rules.filter(r => r.status === "active").length;
  const pausedRulesCount = rules.filter(r => r.status === "paused").length;
  
  let estMonthlyExpense = 0;
  rules.filter(r => r.type === "expense" && r.status === "active").forEach(r => {
    let multiplier = 1;
    const parts = r.cron_expression?.split(' ') || [];
    if (parts.length === 5) {
      if (parts[4] !== '*' && parts[2] === '*') multiplier = 4.33;
      else if (parts[2] !== '*' && parts[4] === '*') multiplier = 1;
      else if (parts[2] === '*' && parts[4] === '*') multiplier = 30;
    }
    estMonthlyExpense += Number(r.amount) * multiplier;
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Aturan aktif"
          value={activeRulesCount}
          icon={Activity}
        />
        <MetricCard
          label="Dijeda"
          value={pausedRulesCount}
          icon={Pause}
        />
        <MetricCard
          label="Perkiraan pengeluaran per bulan"
          value={amount(estMonthlyExpense)}
          icon={TrendingDown}
          trend={{ value: "Hanya yang aktif", isNeutral: true }}
        />
      </div>

      <ListCard 
        title="Transaksi berulang"
        description="Transaksi yang dicatat otomatis sesuai jadwal"
        headerAction={
          <button 
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink disabled:pointer-events-none disabled:opacity-50"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Aturan baru
          </button>
        }
      >
        {rules.map(rule => (
          <ListCardItem key={rule.id} className="flex items-center justify-between group">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{rule.name}</span>
                <Badge variant={rule.status === "active" ? "success" : rule.status === "paused" ? "warning" : "neutral"}>
                  {statusLabels[rule.status] ?? rule.status}
                </Badge>
                <Badge variant="outline">{typeLabels[rule.type] ?? rule.type}</Badge>
              </div>
              <div className="text-sm text-ink-soft">
                {amount(rule.amount)} · Berikutnya: {rule.next_run_at ? dateLabel(rule.next_run_at) : "belum terjadwal"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={`Ubah ${rule.name}`}
                className="flex size-11 items-center justify-center text-ink-soft hover:text-ink hover:bg-paper rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(rule);
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Hapus ${rule.name}`}
                className="flex size-11 items-center justify-center text-ink-soft hover:text-negative hover:bg-negative-soft rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(rule.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </ListCardItem>
        ))}
        {rules.length === 0 && loading ? (
          <LoadingState variant="list" rows={3} label="Memuat aturan berulang" className="p-3 [&_.rounded-2xl]:border-0" />
        ) : rules.length === 0 && loadError ? (
          <ErrorState compact className="border-0" title="Aturan berulang belum bisa dimuat" message={loadError} onRetry={onRetry} />
        ) : rules.length === 0 ? (
          <EmptyState
            illustration="ledger"
            title="Belum ada transaksi berulang"
            description="Tagihan, langganan, atau gaji yang datang rutin bisa dicatat otomatis lewat aturan."
            action={{ label: "Buat aturan pertama", onClick: () => setIsFormOpen(true) }}
          />
        ) : null}
      </ListCard>

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={draft.id ? "Ubah aturan" : "Aturan baru"}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
      >
        <div className="grid gap-4">
          <FormField label="Nama aturan" required>
            <TextField value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </FormField>
          <ResponsiveFormGrid>
            <FormField label="Jenis">
              <NativeSelectField value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DraftRecurringRule["type"], category_id: "" })}>
                {transactionTypes.map((type) => <option key={type} value={type}>{typeLabels[type] ?? type}</option>)}
              </NativeSelectField>
            </FormField>
            <FormField label="Nominal" required>
              <MoneyField value={draft.amount} onValueChange={(amountValue) => setDraft({ ...draft, amount: amountValue })} />
            </FormField>
            <FormField label={draft.type === "transfer" ? "Dompet asal" : "Dompet"}>
              <NativeSelectField value={draft.wallet_id} onChange={(e) => setDraft({ ...draft, wallet_id: e.target.value })}>
                <option value="">Pilih dompet</option>
                {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </NativeSelectField>
            </FormField>
            {draft.type === "transfer" ? (
              <FormField label="Dompet tujuan">
                <NativeSelectField value={draft.destination_wallet_id} onChange={(e) => setDraft({ ...draft, destination_wallet_id: e.target.value })}>
                  <option value="">Pilih dompet</option>
                  {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </NativeSelectField>
              </FormField>
            ) : (
              <FormField label="Kategori">
                <NativeSelectField value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                  <option value="">Tanpa kategori</option>
                  {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelectField>
              </FormField>
            )}
            <FormField label="Pengulangan">
              <NativeSelectField value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value })}>
                {intervals.map((interval) => <option key={interval} value={interval}>{intervalLabels[interval]}</option>)}
              </NativeSelectField>
            </FormField>
            <FormField label="Jam">
              <TimeField value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
            </FormField>
            {draft.interval === "weekly" ? (
              <FormField label="Hari">
                <NativeSelectField value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: e.target.value })}>
                  {weekdays.map((day) => <option key={day} value={day}>{weekdayLabels[day]}</option>)}
                </NativeSelectField>
              </FormField>
            ) : null}
            {draft.interval === "monthly" ? (
              <FormField label="Tanggal (1-31)">
                <TextField inputMode="numeric" pattern="[0-9]*" value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
              </FormField>
            ) : null}
            <FormField label="Status">
              <NativeSelectField value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                {recurringStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </NativeSelectField>
            </FormField>
            <FormField label="Merchant">
              <TextField value={draft.merchant} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} />
            </FormField>
          </ResponsiveFormGrid>
          <FormField label="Catatan">
            <TextareaField value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </FormField>
        </div>
      </FormDialog>
    </div>
  );
}
