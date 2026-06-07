import type { Category, Transaction, TransactionStatus, Wallet } from "@/lib/api";
import { statuses, transactionTypes } from "../model";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { Panel, Pill, SelectField } from "@/components/ui/dashboard";

export function TransactionsView({
  transactions,
  wallets,
  categories,
  walletById,
  categoryById,
  typeFilter,
  statusFilter,
  categoryFilter,
  walletFilter,
  bulkMode,
  selectedBulk,
  onTypeFilter,
  onStatusFilter,
  onCategoryFilter,
  onWalletFilter,
  onToggleBulk,
  onEdit,
  onDelete,
  onBulk,
  onNewTransfer,
}: {
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  query: string;
  typeFilter: string;
  statusFilter: string;
  categoryFilter: string;
  walletFilter: string;
  bulkMode: boolean;
  selectedBulk: Set<string>;
  onTypeFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
  onCategoryFilter: (value: string) => void;
  onWalletFilter: (value: string) => void;
  onToggleBulk: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onBulk: (status: TransactionStatus) => void;
  onNewTransfer: () => void;
}) {
  return (
    <Panel>
      <div className="panel-head">
        <div>
          <p className="eyebrow">Lunch Money style grid</p>
          <h3 className="section-title">{transactions.length} transactions</h3>
        </div>
        <button className="btn-secondary" onClick={onNewTransfer}>
          New transfer
        </button>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <SelectField value={typeFilter} onValueChange={onTypeFilter} options={["all", ...transactionTypes]} />
        <SelectField value={statusFilter} onValueChange={onStatusFilter} options={["all", ...statuses]} />
        <SelectField
          value={walletFilter}
          onValueChange={onWalletFilter}
          options={["all", ...wallets.map((wallet) => wallet.id)]}
          labels={Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name]))}
        />
        <SelectField
          value={categoryFilter}
          onValueChange={onCategoryFilter}
          options={["all", ...categories.map((category) => category.id)]}
          labels={Object.fromEntries(categories.map((category) => [category.id, category.name]))}
        />
      </div>
      {bulkMode && selectedBulk.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-lime-300/40 bg-lime-300/10 px-3 py-2 text-sm">
          <span>{selectedBulk.size} selected</span>
          <button className="btn-compact" onClick={() => onBulk("approved")}>
            Approve
          </button>
          <button className="btn-compact" onClick={() => onBulk("rejected")}>
            Reject
          </button>
          <button className="btn-compact" onClick={() => onBulk("needs_review")}>
            Needs review
          </button>
        </div>
      ) : null}
      <div className="overflow-auto rounded border border-zinc-800">
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="w-12 border-b border-zinc-800 px-3 py-3 text-left">Sel</th>
              <th className="border-b border-zinc-800 px-3 py-3 text-left">Date</th>
              <th className="border-b border-zinc-800 px-3 py-3 text-left">Merchant</th>
              <th className="border-b border-zinc-800 px-3 py-3 text-left">Wallet</th>
              <th className="border-b border-zinc-800 px-3 py-3 text-left">Category</th>
              <th className="border-b border-zinc-800 px-3 py-3 text-left">Status</th>
              <th className="border-b border-zinc-800 px-3 py-3 text-right">Amount</th>
              <th className="border-b border-zinc-800 px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-b border-zinc-900 hover:bg-zinc-900/70">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedBulk.has(transaction.id)}
                    onChange={() => onToggleBulk(transaction.id)}
                    className="h-4 w-4 accent-cyan-300"
                  />
                </td>
                <td className="px-3 py-3 text-zinc-400">{dateLabel(transaction.transaction_at)}</td>
                <td className="px-3 py-3 font-medium">{transaction.merchant || "Unknown"}</td>
                <td className="px-3 py-3">{walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id)}</td>
                <td className="px-3 py-3">
                  {categoryById.get(transaction.category_id ?? "")?.name ?? "Uncategorized"}
                </td>
                <td className="px-3 py-3">
                  <Pill>{transaction.status}</Pill>
                </td>
                <td
                  className={cx(
                    "px-3 py-3 text-right font-semibold",
                    transaction.type === "income" ? "text-lime-300" : "text-zinc-100",
                  )}
                >
                  {amount(transaction.amount)}
                </td>
                <td className="px-3 py-3 text-right">
                  <button className="link-button" onClick={() => onEdit(transaction)}>
                    Edit
                  </button>
                  <button className="link-button text-red-300" onClick={() => onDelete(transaction.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
