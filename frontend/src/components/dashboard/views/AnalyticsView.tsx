import type { AnalyticsSummary, CashflowPoint, SpendingPoint, WalletBalance } from "@/lib/api";
import type { AnalyticsPeriod } from "../model";
import { analyticsPeriodLabels } from "../model";
import { amount, cx, dateLabel } from "../formatters";
import { EmptyState, Fact, Panel } from "@/components/ui/dashboard";

function maxAmount(points: Array<{ amount?: string | number; income?: string | number; expense?: string | number }>) {
  return Math.max(
    1,
    ...points.map((point) => Math.max(Number(point.amount ?? 0), Number(point.income ?? 0), Number(point.expense ?? 0))),
  );
}

export function AnalyticsView({
  summary,
  cashflow,
  spending,
  walletBalances,
  period,
  onPeriodChange,
}: {
  summary: AnalyticsSummary | null;
  cashflow: CashflowPoint[];
  spending: SpendingPoint[];
  walletBalances: WalletBalance[];
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
}) {
  const cashMax = maxAmount(cashflow);
  const spendMax = maxAmount(spending);

  return (
    <div className="grid gap-5">
      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Approved basis</p>
            <h3 className="section-title">{analyticsPeriodLabels[period]}</h3>
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
        {summary ? (
          <dl className="grid gap-3 md:grid-cols-5">
            <Fact label="Income" value={amount(summary.income)} />
            <Fact label="Expense" value={amount(summary.expense)} />
            <Fact label="Net cashflow" value={amount(summary.net_cashflow)} />
            <Fact label="Inbox" value={`${summary.inbox.count} items`} />
            <Fact label="Forecast expense" value={amount(summary.forecast.expense)} />
          </dl>
        ) : (
          <EmptyState title="No analytics yet" body="Approved transactions will build the monthly snapshot." />
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <div className="panel-head">
            <h3 className="section-title">Cashflow</h3>
            <span className="text-sm text-zinc-500">{cashflow.length} days</span>
          </div>
          <div className="grid gap-3">
            {cashflow.length === 0 ? <EmptyState title="No cashflow" body="Approve income and expense transactions first." /> : null}
            {cashflow.map((point) => (
              <div key={point.day} className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex justify-between text-sm">
                  <span>{dateLabel(point.day)}</span>
                  <span>{amount(Number(point.income) - Number(point.expense))}</span>
                </div>
                <div className="mt-3 grid gap-1">
                  <div className="h-2 rounded bg-zinc-800">
                    <div className="h-full rounded bg-lime-300" style={{ width: `${Math.max(4, (Number(point.income) / cashMax) * 100)}%` }} />
                  </div>
                  <div className="h-2 rounded bg-zinc-800">
                    <div className="h-full rounded bg-red-300" style={{ width: `${Math.max(4, (Number(point.expense) / cashMax) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <h3 className="section-title">Spending by category</h3>
            <span className="text-sm text-zinc-500">{spending.length}</span>
          </div>
          <div className="grid gap-3">
            {spending.length === 0 ? <EmptyState title="No spending data" body="Expense categories appear after approval." /> : null}
            {spending.map((point) => (
              <div key={point.id ?? "uncategorized"} className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex justify-between text-sm">
                  <span>{point.name ?? "Uncategorized"}</span>
                  <span>{amount(point.amount)}</span>
                </div>
                <div className="mt-3 h-2 rounded bg-zinc-800">
                  <div className="h-full rounded bg-cyan-300" style={{ width: `${Math.max(4, (Number(point.amount) / spendMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="panel-head">
          <h3 className="section-title">Wallet balances</h3>
          <span className="text-sm text-zinc-500">{walletBalances.length}</span>
        </div>
        <dl className="grid gap-3 md:grid-cols-3">
          {walletBalances.map((wallet) => (
            <Fact key={wallet.wallet_id} label={wallet.name} value={amount(wallet.curr_balance)} />
          ))}
        </dl>
      </Panel>
    </div>
  );
}
