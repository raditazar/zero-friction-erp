import type { FormEvent } from "react";
import type { Category, RecurringRule, Wallet } from "@/lib/api";
import type { DraftRecurringRule } from "../model";
import { transactionTypes } from "../model";
import { amount, dateLabel } from "../formatters";
import { CurrencyInput, SelectField, TextInput, Textarea } from "@/components/ui/dashboard";
import { MetricCard, ListCard, ListCardItem } from "@/components/ui/cards";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Activity, Pause, TrendingDown, Plus, Pencil, Trash2 } from "lucide-react";

const intervals = ["daily", "weekly", "monthly"];
const recurringStatuses = ["active", "paused", "archived"];
const weekdays = ["0", "1", "2", "3", "4", "5", "6"];
const weekdayLabels: Record<string, string> = {
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
};

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
}) {
  const walletLabels = Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name]));
  const categoryOptions = categories.filter((category) => category.type === draft.type);
  const categoryLabels = Object.fromEntries(categoryOptions.map((category) => [category.id, category.name]));

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
          label="Total Active Rules"
          value={activeRulesCount}
          icon={Activity}
        />
        <MetricCard
          label="Paused Rules"
          value={pausedRulesCount}
          icon={Pause}
        />
        <MetricCard
          label="Est Monthly Expense"
          value={amount(estMonthlyExpense)}
          icon={TrendingDown}
          trend={{ value: "Active only", isNeutral: true }}
        />
      </div>

      <ListCard 
        title="Recurring Rules"
        description="Manage your automated transactions"
        headerAction={
          <button 
            className="inline-flex items-center justify-center rounded-md bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white shadow hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1A1A1A] disabled:pointer-events-none disabled:opacity-50"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </button>
        }
      >
        {rules.map(rule => (
          <ListCardItem key={rule.id} className="flex items-center justify-between group">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{rule.name}</span>
                <Badge variant={rule.status === "active" ? "success" : rule.status === "paused" ? "warning" : "neutral"}>
                  {rule.status}
                </Badge>
                <Badge variant="outline">{rule.type}</Badge>
              </div>
              <div className="text-sm text-[#6E6D7A]">
                {amount(rule.amount)} • Next: {rule.next_run_at ? dateLabel(rule.next_run_at) : "Unknown"}
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="p-2 text-[#6E6D7A] hover:text-[#1A1A1A] hover:bg-[#F4F3EE] rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(rule);
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="p-2 text-[#6E6D7A] hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
        {rules.length === 0 && (
          <div className="p-8 text-center text-[#6E6D7A]">
            No recurring rules found.
          </div>
        )}
      </ListCard>

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={draft.id ? "Edit Rule" : "New Rule"}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
      >
        <div className="grid gap-4 py-4">
          <TextInput label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField value={draft.type} onValueChange={(type) => setDraft({ ...draft, type: type as DraftRecurringRule["type"], category_id: "" })} options={transactionTypes} />
            <CurrencyInput label="Amount" value={draft.amount} onChange={(amountValue) => setDraft({ ...draft, amount: amountValue })} required />
            <SelectField value={draft.wallet_id} onValueChange={(wallet_id) => setDraft({ ...draft, wallet_id })} options={wallets.map((w) => w.id)} labels={walletLabels} placeholder="Wallet" />
            {draft.type === "transfer" ? (
              <SelectField value={draft.destination_wallet_id} onValueChange={(destination_wallet_id) => setDraft({ ...draft, destination_wallet_id })} options={wallets.map((w) => w.id)} labels={walletLabels} placeholder="Destination" />
            ) : (
              <SelectField value={draft.category_id} onValueChange={(category_id) => setDraft({ ...draft, category_id })} options={categoryOptions.map((c) => c.id)} labels={categoryLabels} placeholder="Category" />
            )}
            <SelectField value={draft.interval} onValueChange={(interval) => setDraft({ ...draft, interval })} options={intervals} />
            <TextInput label="Time" type="time" value={draft.time} onChange={(time) => setDraft({ ...draft, time })} />
            {draft.interval === "weekly" ? (
              <SelectField value={draft.weekday} onValueChange={(weekday) => setDraft({ ...draft, weekday })} options={weekdays} labels={weekdayLabels} />
            ) : null}
            {draft.interval === "monthly" ? (
              <TextInput label="Day of month" type="number" value={draft.day_of_month} onChange={(day_of_month) => setDraft({ ...draft, day_of_month })} />
            ) : null}
            <SelectField value={draft.status} onValueChange={(status) => setDraft({ ...draft, status })} options={recurringStatuses} />
            <TextInput label="Merchant" value={draft.merchant} onChange={(merchant) => setDraft({ ...draft, merchant })} />
          </div>
          <Textarea label="Note" value={draft.note} onChange={(note) => setDraft({ ...draft, note })} />
        </div>
      </FormDialog>
    </div>
  );
}
