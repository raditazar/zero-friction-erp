import type { Category, Transaction, Wallet } from "@/lib/api";
import { amount, shortID } from "../formatters";
import { EmptyState, Panel, Pill } from "@/components/ui/dashboard";

export function ReimbursementsView({
  reimbursements,
  walletById,
  categoryById,
  onMark,
  onSettle,
}: {
  reimbursements: Transaction[];
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  onMark: (id: string) => void;
  onSettle: (id: string) => void;
}) {
  return (
    <Panel>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Zero-sum reimbursement</p>
          <h3 className="section-title">{reimbursements.length} tracked</h3>
        </div>
      </div>
      <div className="grid gap-2">
        {reimbursements.length === 0 ? <EmptyState title="No reimbursement yet" body="Mark a transaction as reimbursement from the detail flow." /> : null}
        {reimbursements.map((transaction) => (
          <div key={transaction.id} className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{transaction.merchant ?? "Unknown"}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id)} -{" "}
                  {categoryById.get(transaction.category_id ?? "")?.name ?? "Uncategorized"}
                </p>
              </div>
              <p className="font-semibold">{amount(transaction.amount)}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill>{transaction.reimbursement_status}</Pill>
              <button className="btn-compact" onClick={() => onMark(transaction.id)}>Mark receivable</button>
              <button className="btn-compact" onClick={() => onSettle(transaction.id)}>Settle</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
