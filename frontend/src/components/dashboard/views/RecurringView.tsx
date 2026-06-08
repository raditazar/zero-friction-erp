import type { FormEvent } from "react";
import type { Category, RecurringRule, Wallet } from "@/lib/api";
import type { DraftRecurringRule } from "../model";
import { transactionTypes } from "../model";
import { amount, dateLabel, shortID } from "../formatters";
import { CurrencyInput, DataList, Panel, SelectField, TextInput, Textarea } from "@/components/ui/dashboard";

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
  onRunDue,
}: {
  rules: RecurringRule[];
  wallets: Wallet[];
  categories: Category[];
  draft: DraftRecurringRule;
  setDraft: (draft: DraftRecurringRule) => void;
  onSubmit: (event: FormEvent) => void;
  onEdit: (rule: RecurringRule) => void;
  onDelete: (id: string) => void;
  onRunDue: () => void;
}) {
  const walletLabels = Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name]));
  const categoryOptions = categories.filter((category) => category.type === draft.type);
  const categoryLabels = Object.fromEntries(categoryOptions.map((category) => [category.id, category.name]));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.85fr)_minmax(460px,1.15fr)]">
      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Recurring rules</p>
            <h3 className="section-title">{draft.id ? "Edit rule" : "New rule"}</h3>
          </div>
        </div>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <TextInput label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField value={draft.type} onValueChange={(type) => setDraft({ ...draft, type: type as DraftRecurringRule["type"], category_id: "" })} options={transactionTypes} />
            <CurrencyInput label="Amount" value={draft.amount} onChange={(amountValue) => setDraft({ ...draft, amount: amountValue })} required />
            <SelectField value={draft.wallet_id} onValueChange={(wallet_id) => setDraft({ ...draft, wallet_id })} options={wallets.map((wallet) => wallet.id)} labels={walletLabels} placeholder="Wallet" />
            {draft.type === "transfer" ? (
              <SelectField value={draft.destination_wallet_id} onValueChange={(destination_wallet_id) => setDraft({ ...draft, destination_wallet_id })} options={wallets.map((wallet) => wallet.id)} labels={walletLabels} placeholder="Destination" />
            ) : (
              <SelectField value={draft.category_id} onValueChange={(category_id) => setDraft({ ...draft, category_id })} options={categoryOptions.map((category) => category.id)} labels={categoryLabels} placeholder="Category" />
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
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">{draft.id ? "Update rule" : "Create rule"}</button>
          </div>
        </form>
      </Panel>

      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Schedule</p>
            <h3 className="section-title">{rules.length} rules</h3>
          </div>
          <button className="btn-secondary" onClick={onRunDue}>Run due</button>
        </div>
        <DataList
          rows={rules.map((rule) => ({
            id: rule.id,
            title: `${rule.name} - ${amount(rule.amount)}`,
            meta: `${rule.status} - next ${rule.next_run_at ? dateLabel(rule.next_run_at) : shortID(rule.id)}`,
            action: (
              <>
                <button className="link-button" onClick={() => onEdit(rule)}>Edit</button>
                <button className="link-button danger-text" onClick={() => onDelete(rule.id)}>Delete</button>
              </>
            ),
          }))}
        />
      </Panel>
    </div>
  );
}
