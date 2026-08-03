import type {
  AnalyticsSummary,
  CashflowPoint,
  Category,
  SpendingPoint,
  Transaction,
  Wallet,
  WalletBalance,
} from "@/lib/api";
import { Fact, Panel, Pill } from "@/components/ui/dashboard";
import { EmptyState } from "@/components/ui/feedback";
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

type Avatar = {
  src: string;
  alt: string;
};

const metricAvatars: Avatar[] = [
  {
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    alt: "Finance operator",
  },
  {
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    alt: "Reviewer",
  },
  {
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
    alt: "Approver",
  },
];

function PaymentSummaryCard({
  title,
  amountDisplay,
  subCardTitle,
  subCardSubtitle,
  onSubCardClick,
}: {
  title: string;
  amountDisplay: string;
  subCardTitle: string;
  subCardSubtitle: string;
  onSubCardClick?: () => void;
  [key: string]: any;
}) {
  return (
    <Panel className="bg-[#FFFFFF] text-[#1A1A1A] border-0 shadow-sm rounded-2xl p-6 cursor-pointer hover:bg-[#F9F8F5] transition-colors" onClick={onSubCardClick}>
      <p className="text-xs font-mono font-medium tracking-wider text-[#6E6D7A] uppercase">{title}</p>
      <h4 className="mt-2 text-3xl font-extrabold tabular-nums">{amountDisplay}</h4>
      <div className="mt-4 border-t border-[#2C3639] pt-4">
        <p className="text-xs font-medium text-[#1A1A1A]">{subCardTitle}</p>
        <p className="text-xs text-[#6E6D7A] mt-0.5">{subCardSubtitle}</p>
      </div>
    </Panel>
  );
}

export function DashboardView({
  summary,
  cashflow = [],
  spending = [],
  spendingCategories = [],
  walletBalances = [],
  inbox = [],
  selected,
  recentTransactions = [],
  walletById = new Map(),
  categoryById = new Map(),
  ready = { status: "ok" },
  deadLetterCount = 0,
  busy = false,
  onReview = () => {},
  onAnalytics = () => {},
  onSelectInbox = () => {},
  onSelect = () => {},
  onApprove = () => {},
  onReject = () => {},
  onEdit = () => {},
}: {
  summary: AnalyticsSummary | null;
  cashflow?: CashflowPoint[];
  spending?: SpendingPoint[];
  spendingCategories?: SpendingPoint[];
  walletBalances?: WalletBalance[];
  inbox?: Transaction[];
  selected?: Transaction;
  recentTransactions?: Transaction[];
  walletById?: Map<string, Wallet>;
  categoryById?: Map<string, Category>;
  ready?: { status: string; database?: string } | null;
  deadLetterCount?: number;
  busy?: boolean;
  onReview?: () => void;
  onAnalytics?: () => void;
  onSelectInbox?: () => void;
  onSelect?: (id: string) => void;
  onApprove?: (transaction: Transaction) => void | Promise<void>;
  onReject?: (transaction: Transaction) => void | Promise<void>;
  onEdit?: (transaction: Transaction) => void;
}) {
  const rawSpending = spending.length > 0 ? spending : (spendingCategories as SpendingPoint[]);
  const totalBalance = walletBalances.reduce((total, wallet) => total + numberValue(wallet.curr_balance), 0);
  const cashMax = maxAmount(cashflow);
  const spendMax = maxAmount(rawSpending);
  const topInbox = inbox.slice(0, 4);
  const topSpending = rawSpending.slice(0, 5);
  const recentCashflow = cashflow.slice(-7);
  const net = numberValue(summary?.net_cashflow);
  const forecastExpense = numberValue(summary?.forecast.expense);
  const readyCount = summary?.inbox.count ?? inbox.length;
  const pendingAmount = numberValue(summary?.inbox.amount);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <PaymentSummaryCard
          title="Ready to review"
          amount={readyCount}
          amountDisplay={`${readyCount.toLocaleString("en-US")} items`}
          currency=""
          subCardTitle="Review inbox"
          subCardSubtitle="Current month drafts"
          avatars={metricAvatars}
          moreCount={Math.max(0, readyCount - metricAvatars.length)}
          onSubCardClick={onReview}
          className="max-w-none"
        />
        <PaymentSummaryCard
          title="Pending amount"
          amount={pendingAmount}
          amountDisplay={amount(pendingAmount)}
          currency=""
          subCardTitle="Needs approval"
          subCardSubtitle="Unapproved cash movement"
          avatars={metricAvatars}
          moreCount={readyCount}
          onSubCardClick={onReview}
          className="max-w-none"
        />
        <PaymentSummaryCard
          title="Net cashflow"
          amount={Math.abs(net)}
          amountDisplay={amount(net)}
          currency=""
          subCardTitle={net >= 0 ? "Positive month" : "Negative month"}
          subCardSubtitle="Income minus expense"
          avatars={metricAvatars}
          moreCount={cashflow.length}
          onSubCardClick={onAnalytics}
          className="max-w-none"
        />
        <PaymentSummaryCard
          title="Total balance"
          amount={totalBalance}
          amountDisplay={amount(totalBalance)}
          currency=""
          subCardTitle="Wallet balances"
          subCardSubtitle="Across active accounts"
          avatars={metricAvatars}
          moreCount={Math.max(0, walletBalances.length - metricAvatars.length)}
          onSubCardClick={onAnalytics}
          className="max-w-none"
        />
      </div>

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
              <EmptyState title="Inbox is clear" description="New Gemini and webhook drafts will land here." />
            ) : null}
            {topInbox.map((transaction) => (
              <button
                key={transaction.id}
                onClick={() => onSelect(transaction.id)}
                className={cx(
                  "rounded p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#10F5CC]",
                  selected?.id === transaction.id
                    ? "border border-[#10F5CC]/24 bg-[#10F5CC]/10"
                    : "border border-[#F5FEFD]/8 bg-[#F9F8F5] hover:bg-[#273538]/70",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{transaction.merchant || "Unknown merchant"}</p>
                    <p className="mt-1 truncate text-xs text-[#1A1A1A]/46">
                      {walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id)} -{" "}
                      {categoryById.get(transaction.category_id ?? "")?.name ?? "Uncategorized"}
                    </p>
                  </div>
                  <span className={cx("text-sm font-semibold", transaction.type === "income" && "text-[#1A1A1A]")}>
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
            <div className="mt-4 rounded-md border border-[#F5FEFD]/8 bg-[#F9F8F5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Selected</p>
                  <p className="mt-1 truncate text-sm text-[#1A1A1A]/86">{selected.merchant || "Unknown merchant"}</p>
                </div>
                <span className="text-sm font-semibold">{amount(selected.amount)}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-[#1A1A1A]/48">{selected.raw_input || selected.note || "-"}</p>
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
                <h3 className="section-title">Current month</h3>
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
              <div className="rounded-md  bg-[#F9F8F5] p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[#1A1A1A]/62">Cashflow direction</span>
                  <span className={cx("font-semibold", net >= 0 ? "text-[#1A1A1A]" : "text-[#1A1A1A]/72")}>
                    {net >= 0 ? "Positive" : "Negative"}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded bg-[#273538]/90">
                  <div
                    className={cx("h-full rounded", net >= 0 ? "bg-[#7DD3FC]" : "bg-[#F6C177]")}
                    style={{ width: pct(Math.abs(net), Math.max(numberValue(summary.income), numberValue(summary.expense), 1)) }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No monthly snapshot" description="Approve transactions to build the dashboard." />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <div className="panel-head">
            <h3 className="section-title">Top spending</h3>
            <span className="text-sm text-[#1A1A1A]/46">{topSpending.length}</span>
          </div>
          <div className="grid gap-3">
            {topSpending.length === 0 ? <EmptyState title="No spending yet" description="Approved expenses appear here." /> : null}
            {topSpending.map((point) => (
              <div key={point.id ?? "uncategorized"}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate text-[#1A1A1A]/74">{point.name ?? "Uncategorized"}</span>
                  <span>{amount(point.amount)}</span>
                </div>
                <div className="mt-2 h-2 rounded bg-[#273538]/90">
                  <div className="h-full rounded bg-[#A7B8BB]" style={{ width: pct(point.amount, spendMax) }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <h3 className="section-title">Recent cashflow</h3>
            <span className="text-sm text-[#1A1A1A]/46">{recentCashflow.length} days</span>
          </div>
          <div className="grid gap-3">
            {recentCashflow.length === 0 ? <EmptyState title="No cashflow yet" description="Income and expenses appear after approval." /> : null}
            {recentCashflow.map((point) => (
              <div key={point.day}>
                <div className="flex justify-between text-sm">
                  <span className="text-[#1A1A1A]/62">{dateLabel(point.day)}</span>
                  <span>{amount(numberValue(point.income) - numberValue(point.expense))}</span>
                </div>
                <div className="mt-2 grid gap-1">
                  <div className="h-1.5 rounded bg-[#273538]/90">
                    <div className="h-full rounded bg-[#7DD3FC]" style={{ width: pct(point.income, cashMax) }} />
                  </div>
                  <div className="h-1.5 rounded bg-[#273538]/90">
                    <div className="h-full rounded bg-[#F6C177]" style={{ width: pct(point.expense, cashMax) }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <h3 className="section-title">System posture</h3>
            <span className={cx("text-sm", ready?.status === "ok" ? "text-[#1A1A1A]" : "text-[#1A1A1A]/72")}>
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
