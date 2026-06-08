import type {
  AnalyticsSummary,
  CashflowPoint,
  Category,
  SpendingPoint,
  Transaction,
  Wallet,
  WalletBalance,
} from "@/lib/api";
import { EmptyState, Fact, Panel, Pill } from "@/components/ui/dashboard";
import type { AnalyticsPeriod } from "../model";
import { analyticsPeriodLabels } from "../model";
import { amount, cx, dateLabel, shortID } from "../formatters";

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function maxAmount(points: Array<{ amount?: string | number; income?: string | number; expense?: string | number }>) {
  return Math.max(
    1,
    ...points.map((point) => Math.max(numberValue(point.amount), numberValue(point.income), numberValue(point.expense))),
  );
}

function pct(value: string | number | null | undefined, max: number) {
  return `${Math.max(5, Math.min(100, (numberValue(value) / max) * 100))}%`;
}

export function DashboardView({
  summary,
  cashflow,
  spending,
  walletBalances,
  inbox,
  selected,
  walletById,
  categoryById,
  ready,
  deadLetterCount,
  period,
  busy,
  onPeriodChange,
  onReview,
  onAnalytics,
  onSelect,
  onApprove,
  onReject,
  onEdit,
}: {
  summary: AnalyticsSummary | null;
  cashflow: CashflowPoint[];
  spending: SpendingPoint[];
  walletBalances: WalletBalance[];
  inbox: Transaction[];
  selected?: Transaction;
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  ready: { status: string; database?: string } | null;
  deadLetterCount: number;
  period: AnalyticsPeriod;
  busy: boolean;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onReview: () => void;
  onAnalytics: () => void;
  onSelect: (id: string) => void;
  onApprove: (transaction: Transaction) => void | Promise<void>;
  onReject: (transaction: Transaction) => void | Promise<void>;
  onEdit: (transaction: Transaction) => void;
}) {
  const totalBalance = walletBalances.reduce((total, wallet) => total + numberValue(wallet.curr_balance), 0);
  const cashMax = maxAmount(cashflow);
  const spendMax = maxAmount(spending);
  const topInbox = inbox.slice(0, 4);
  const topSpending = spending.slice(0, 5);
  const recentCashflow = cashflow.slice(-7);
  const net = numberValue(summary?.net_cashflow);
  const forecastExpense = numberValue(summary?.forecast.expense);

  return (
    <div className="grid gap-5">
      <Panel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Command center</p>
            <h3 className="section-title mt-1">Review first, then understand the month</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              A readable dashboard should be compact, but not cramped: the top row shows the next action, the money
              signal, and the system state without forcing you into a chart-heavy page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["current_month", "last_30_days", "previous_month"] as AnalyticsPeriod[]).map((option) => (
              <button
                key={option}
                className={cx("btn-compact", period === option && "border-cyan-300 bg-cyan-300/15 text-cyan-100")}
                onClick={() => onPeriodChange(option)}
              >
                {analyticsPeriodLabels[option]}
              </button>
            ))}
          </div>
        </div>
        <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Fact label="Ready to review" value={`${summary?.inbox.count ?? inbox.length} items`} />
          <Fact label="Pending amount" value={amount(summary?.inbox.amount ?? 0)} />
          <Fact label="Net cashflow" value={amount(net)} />
          <Fact label="Total balance" value={amount(totalBalance)} />
        </dl>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.25fr)]">
        <Panel>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Next action</p>
              <h3 className="section-title">Transactions to Review</h3>
            </div>
            <button className="btn-secondary" onClick={onReview}>
              Open Review
            </button>
          </div>
          <div className="grid gap-2">
            {topInbox.length === 0 ? (
              <EmptyState title="Inbox is clear" body="New Gemini and webhook drafts will land here." />
            ) : null}
            {topInbox.map((transaction) => (
              <button
                key={transaction.id}
                onClick={() => onSelect(transaction.id)}
                className={cx(
                  "rounded border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300",
                  selected?.id === transaction.id
                    ? "border-cyan-300 bg-cyan-300/10"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{transaction.merchant || "Unknown merchant"}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id)} -{" "}
                      {categoryById.get(transaction.category_id ?? "")?.name ?? "Uncategorized"}
                    </p>
                  </div>
                  <span className={cx("text-sm font-semibold", transaction.type === "income" && "text-lime-300")}>
                    {amount(transaction.amount)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill>{transaction.type}</Pill>
                  <Pill>{transaction.input_source ?? "manual"}</Pill>
                  <Pill>{transaction.ai_confidence ? `AI ${transaction.ai_confidence}` : "AI n/a"}</Pill>
                </div>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Selected</p>
                  <p className="mt-1 truncate text-sm text-zinc-200">{selected.merchant || "Unknown merchant"}</p>
                </div>
                <span className="text-sm font-semibold">{amount(selected.amount)}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-zinc-500">{selected.raw_input || selected.note || "-"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" disabled={busy} onClick={() => onApprove(selected)}>
                  Approve
                </button>
                <button className="btn-secondary" disabled={busy} onClick={() => onEdit(selected)}>
                  Correct
                </button>
                <button className="btn-danger" disabled={busy} onClick={() => onReject(selected)}>
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Approved basis</p>
              <h3 className="section-title">{analyticsPeriodLabels[period]}</h3>
            </div>
            <button className="btn-secondary" onClick={onAnalytics}>
              Open Analytics
            </button>
          </div>
          {summary ? (
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Fact label="Income" value={amount(summary.income)} />
                <Fact label="Expense" value={amount(summary.expense)} />
                <Fact label="Forecast expense" value={amount(forecastExpense)} />
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Cashflow direction</span>
                  <span className={cx("font-semibold", net >= 0 ? "text-lime-300" : "text-red-300")}>
                    {net >= 0 ? "Positive" : "Negative"}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded bg-zinc-800">
                  <div
                    className={cx("h-full rounded", net >= 0 ? "bg-lime-300" : "bg-red-300")}
                    style={{ width: pct(Math.abs(net), Math.max(numberValue(summary.income), numberValue(summary.expense), 1)) }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No monthly snapshot" body="Approve transactions to build the dashboard." />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <div className="panel-head">
            <h3 className="section-title">Top spending</h3>
            <span className="text-sm text-zinc-500">{topSpending.length}</span>
          </div>
          <div className="grid gap-3">
            {topSpending.length === 0 ? <EmptyState title="No spending yet" body="Approved expenses appear here." /> : null}
            {topSpending.map((point) => (
              <div key={point.id ?? "uncategorized"}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate text-zinc-300">{point.name ?? "Uncategorized"}</span>
                  <span>{amount(point.amount)}</span>
                </div>
                <div className="mt-2 h-2 rounded bg-zinc-800">
                  <div className="h-full rounded bg-cyan-300" style={{ width: pct(point.amount, spendMax) }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <h3 className="section-title">Recent cashflow</h3>
            <span className="text-sm text-zinc-500">{recentCashflow.length} days</span>
          </div>
          <div className="grid gap-3">
            {recentCashflow.length === 0 ? <EmptyState title="No cashflow yet" body="Income and expenses appear after approval." /> : null}
            {recentCashflow.map((point) => (
              <div key={point.day}>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{dateLabel(point.day)}</span>
                  <span>{amount(numberValue(point.income) - numberValue(point.expense))}</span>
                </div>
                <div className="mt-2 grid gap-1">
                  <div className="h-1.5 rounded bg-zinc-800">
                    <div className="h-full rounded bg-lime-300" style={{ width: pct(point.income, cashMax) }} />
                  </div>
                  <div className="h-1.5 rounded bg-zinc-800">
                    <div className="h-full rounded bg-red-300" style={{ width: pct(point.expense, cashMax) }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <h3 className="section-title">System posture</h3>
            <span className={cx("text-sm", ready?.status === "ok" ? "text-lime-300" : "text-red-300")}>
              {ready?.status ?? "unknown"}
            </span>
          </div>
          <dl className="grid gap-3">
            <Fact label="Database" value={ready?.database ?? "unknown"} />
            <Fact label="Wallets" value={`${walletBalances.length} active`} />
            <Fact label="Dead letters" value={`${deadLetterCount} open`} />
          </dl>
        </Panel>
      </div>
    </div>
  );
}
