import * as Dialog from "@radix-ui/react-dialog";
import type { FormEvent } from "react";
import type { Category, Transaction, TransactionStatus, TransactionType, Wallet } from "@/lib/api";
import type { DraftTransaction } from "./model";
import { statuses, transactionTypes } from "./model";
import { amount } from "./formatters";
import { CurrencyInput, SelectField, Textarea, TextInput } from "@/components/ui/dashboard";

function timestampDate(value: string) {
  return value ? value.slice(0, 10) : "";
}

function timestampTime(value: string) {
  return value && value.length >= 16 ? value.slice(11, 16) : "";
}

function updateTimestamp(value: string, part: "date" | "time", nextValue: string) {
  const date = part === "date" ? nextValue : timestampDate(value);
  const time = part === "time" ? nextValue : timestampTime(value);
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function TransactionDialog({
  title,
  open,
  onOpenChange,
  draft,
  setDraft,
  wallets,
  categories,
  onSubmit,
  busy,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DraftTransaction;
  setDraft: (draft: DraftTransaction) => void;
  wallets: Wallet[];
  categories: Category[];
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
}) {
  const categoryOptions = categories.filter((category) => category.type === draft.type);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[86vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded border border-zinc-800 bg-[#090b11] p-5 text-zinc-100 shadow-2xl outline-none">
          <div className="panel-head">
            <div>
              <Dialog.Title className="section-title">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-zinc-500">
                Manual entry stores exactly what you type. Use Gemini capture in Review when raw text should be parsed
                into amount, merchant, wallet, and category.
              </Dialog.Description>
            </div>
            <Dialog.Close className="btn-secondary">Close</Dialog.Close>
          </div>
          <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-3 md:grid-cols-3">
              <SelectField value={draft.type} onValueChange={(type) => setDraft({ ...draft, type: type as TransactionType, category_id: "" })} options={transactionTypes} />
              <SelectField value={draft.status} onValueChange={(status) => setDraft({ ...draft, status: status as TransactionStatus })} options={statuses} />
              <CurrencyInput label="Amount" value={draft.amount} onChange={(amountValue) => setDraft({ ...draft, amount: amountValue })} required />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField
                value={draft.wallet_id}
                onValueChange={(wallet_id) => setDraft({ ...draft, wallet_id })}
                options={wallets.map((wallet) => wallet.id)}
                labels={Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name]))}
                placeholder="Wallet"
              />
              {draft.type === "transfer" ? (
                <SelectField
                  value={draft.destination_wallet_id}
                  onValueChange={(destination_wallet_id) => setDraft({ ...draft, destination_wallet_id })}
                  options={wallets.map((wallet) => wallet.id)}
                  labels={Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name]))}
                  placeholder="Destination wallet"
                />
              ) : (
                <SelectField
                  value={draft.category_id}
                  onValueChange={(category_id) => setDraft({ ...draft, category_id })}
                  options={categoryOptions.map((category) => category.id)}
                  labels={Object.fromEntries(categoryOptions.map((category) => [category.id, category.name]))}
                  placeholder="Category"
                />
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput label="Merchant" value={draft.merchant} onChange={(merchant) => setDraft({ ...draft, merchant })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label="Date"
                  type="date"
                  value={timestampDate(draft.transaction_at)}
                  onChange={(date) =>
                    setDraft({ ...draft, transaction_at: updateTimestamp(draft.transaction_at, "date", date) })
                  }
                />
                <TextInput
                  label="Time"
                  type="time"
                  value={timestampTime(draft.transaction_at)}
                  onChange={(time) =>
                    setDraft({ ...draft, transaction_at: updateTimestamp(draft.transaction_at, "time", time) })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={draft.is_reimbursement} onChange={(event) => setDraft({ ...draft, is_reimbursement: event.target.checked, reimbursement_status: event.target.checked ? "receivable" : "none" })} className="h-4 w-4 accent-cyan-300" />
              Reimbursement / dana talangan
            </label>
            <Textarea label="Note" value={draft.note} onChange={(note) => setDraft({ ...draft, note })} />
            <div className="grid gap-2">
              <Textarea label="Source text / audit note (not parsed)" value={draft.raw_input} onChange={(raw_input) => setDraft({ ...draft, raw_input })} />
              <p className="text-xs leading-5 text-zinc-500">
                This is saved with the transaction for traceability. Use Gemini capture in Review when source text should
                become a review draft automatically.
              </p>
            </div>
            <div className="flex justify-end">
              <button disabled={busy} className="btn-primary" type="submit">
                {busy ? "Saving..." : "Save transaction"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AllocationDialog({
  open,
  transaction,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const value = Number(transaction?.amount ?? 0);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded border border-cyan-300/30 bg-[#090b11] p-5 text-zinc-100 shadow-2xl outline-none">
          <Dialog.Title className="section-title">Route ad-hoc income first</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-zinc-400">
            Preview alokasi wajib sebelum income masuk ke saldo siap belanja.
          </Dialog.Description>
          <div className="mt-5 rounded border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex justify-between text-sm">
              <span>Ready to spend</span>
              <span>{amount(value * 0.5)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-800">
              <div className="h-full w-1/2 bg-cyan-300" />
            </div>
            <div className="mt-5 flex justify-between text-sm">
              <span>Saving / investment</span>
              <span>{amount(value * 0.5)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-800">
              <div className="h-full w-1/2 bg-lime-300" />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close className="btn-secondary">Cancel</Dialog.Close>
            <button disabled={busy} className="btn-primary" onClick={onConfirm}>
              Confirm allocation
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const shortcuts = [
    ["J / K", "Move selection"],
    ["Enter", "Open detail"],
    ["A", "Approve selected"],
    ["R", "Reject selected"],
    ["E", "Edit selected"],
    ["/", "Search"],
    ["Esc", "Close or clear"],
  ];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded border border-zinc-800 bg-[#090b11] p-5 text-zinc-100 shadow-2xl outline-none">
          <Dialog.Title className="section-title">Keyboard triage</Dialog.Title>
          <div className="mt-4 grid gap-2">
            {shortcuts.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <span className="kbd">{key}</span>
                <span className="text-sm text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

