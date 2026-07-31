import type { Category, Transaction, Wallet } from "@/lib/api";
import type { FormEvent } from "react";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { EmptyState, Fact, Panel, Pill, Textarea } from "@/components/ui/dashboard";

export function ReviewView({
  inbox,
  selected,
  walletById,
  categoryById,
  busy,
  aiText,
  aiNotice,
  onSelect,
  onAIText,
  onExtract,
  onApprove,
  onReject,
  onEdit,
}: {
  inbox: Transaction[];
  selected?: Transaction;
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  busy: boolean;
  aiText: string;
  aiNotice: string;
  onSelect: (id: string) => void;
  onAIText: (value: string) => void;
  onExtract: (event: FormEvent) => void;
  onApprove: (transaction: Transaction) => void | Promise<void>;
  onReject: (transaction: Transaction) => void | Promise<void>;
  onEdit: (transaction: Transaction) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.4fr)]">
      <Panel>
        <form className="mb-5 rounded-lg border border-[#10F5CC]/18 bg-[#1B2326] p-3" onSubmit={onExtract}>
          <div className="panel-head mb-3">
            <div>
              <p className="eyebrow">Gemini capture</p>
              <h3 className="section-title">Raw text to review draft</h3>
            </div>
            <button className="btn-primary" disabled={busy || !aiText.trim()} type="submit">
              Extract
            </button>
          </div>
          <Textarea label="Raw text" value={aiText} onChange={onAIText} />
          {aiNotice ? (
            <p className="mt-3 rounded-md border border-[#10F5CC]/18 bg-[#202A2D] px-3 py-2 text-sm text-[#F5FEFD]/88">
              {aiNotice}
            </p>
          ) : null}
        </form>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Transactions to Review</p>
            <h3 className="section-title">{inbox.length} waiting</h3>
          </div>
          <span className="kbd">J/K</span>
        </div>
        <div className="grid gap-2">
          {inbox.length === 0 ? <EmptyState title="Inbox is clear" body="New AI guesses will land here." /> : null}
          {inbox.map((transaction) => (
            <button
              key={transaction.id}
              onClick={() => onSelect(transaction.id)}
              className={cx(
                "rounded p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#10F5CC]",
                selected?.id === transaction.id
                  ? "border border-[#10F5CC]/24 bg-[#10F5CC]/10"
                  : "border border-[#F5FEFD]/8 bg-[#1B2326] hover:bg-[#273538]/70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{transaction.merchant || "Unknown merchant"}</p>
                  <p className="mt-1 text-xs text-[#F5FEFD]/46">
                    {walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id)} -{" "}
                    {categoryById.get(transaction.category_id ?? "")?.name ?? "Uncategorized"}
                  </p>
                </div>
                <span className={cx("text-sm font-semibold", transaction.type === "income" ? "text-[#10F5CC]" : "")}>
                  {amount(transaction.amount)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill>{transaction.type}</Pill>
                <Pill>{transaction.status}</Pill>
                <Pill>{transaction.input_source ?? "manual"}</Pill>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        {selected ? (
          <>
            <div className="panel-head">
              <div>
                <p className="eyebrow">AI guess detail</p>
                <h3 className="section-title">{selected.merchant || "Unknown merchant"}</h3>
              </div>
              <span className="text-xl font-semibold">{amount(selected.amount)}</span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact label="Wallet" value={walletById.get(selected.wallet_id)?.name ?? shortID(selected.wallet_id)} />
              <Fact
                label="Category"
                value={categoryById.get(selected.category_id ?? "")?.name ?? "Needs category"}
              />
              <Fact label="Timestamp" value={dateLabel(selected.transaction_at)} />
              <Fact label="Confidence" value={selected.ai_confidence ? String(selected.ai_confidence) : "n/a"} />
              <Fact label="Input" value={`${selected.input_source ?? "manual"} / ${selected.input_mode ?? "text"}`} />
              <Fact label="Reimburse" value={selected.is_reimbursement ? selected.reimbursement_status : "none"} />
            </dl>
            <div className="mt-4 rounded-md border border-[#F5FEFD]/8 bg-[#1B2326] p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#F5FEFD]/46">Raw input</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#F5FEFD]/74">{selected.raw_input || selected.note || "-"}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button disabled={busy} className="btn-primary" onClick={() => onApprove(selected)}>
                Approve A
              </button>
              <button disabled={busy} className="btn-secondary" onClick={() => onEdit(selected)}>
                Correct E
              </button>
              <button disabled={busy} className="btn-danger" onClick={() => onReject(selected)}>
                Reject R
              </button>
            </div>
          </>
        ) : (
          <EmptyState title="No transaction selected" body="Use J/K or click a row to inspect the AI guess." />
        )}
      </Panel>
    </div>
  );
}
