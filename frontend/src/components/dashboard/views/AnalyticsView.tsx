import type { AnalyticsSummary, CashflowPoint, SpendingPoint, WalletBalance } from "@/lib/api";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { amount, dateLabel } from "../formatters";
import { EmptyState, Fact, Panel } from "@/components/ui/dashboard";

function maxAmount(points: Array<{ amount?: string | number; income?: string | number; expense?: string | number }>) {
  return Math.max(
    1,
    ...points.map((point) => Math.max(Number(point.amount ?? 0), Number(point.income ?? 0), Number(point.expense ?? 0))),
  );
}

type BalancePoint = {
  date: string;
  value: number;
  rawDate: string;
};

const chartConfig = {
  value: {
    label: "Balance",
    color: "#4F46E5",
  },
};

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function buildBalanceData(cashflow: CashflowPoint[], walletBalances: WalletBalance[]) {
  const currentBalance = walletBalances.reduce((total, wallet) => total + numberValue(wallet.curr_balance), 0);
  const monthlyNet = cashflow.reduce((total, point) => total + numberValue(point.income) - numberValue(point.expense), 0);
  let runningBalance = currentBalance - monthlyNet;

  return cashflow.map((point) => {
    runningBalance += numberValue(point.income) - numberValue(point.expense);
    return {
      date: shortDate(point.day),
      rawDate: point.day,
      value: runningBalance,
    };
  });
}

interface BalanceTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: BalancePoint;
  }>;
  currency: string;
}

function BalanceTooltip({ active, payload, currency }: BalanceTooltipProps) {
  if (active && payload?.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <div className="text-sm text-muted-foreground mb-1">{dateLabel(data.rawDate)}</div>
        <div className="flex items-center gap-2">
          <div className="text-base font-bold">{formatCurrency(data.value, currency)}</div>
          <div className="text-[11px] text-emerald-600">Balance</div>
        </div>
      </div>
    );
  }
  return null;
}

function BalanceTrendChart({
  cashflow,
  currency,
  walletBalances,
}: {
  cashflow: CashflowPoint[];
  currency: string;
  walletBalances: WalletBalance[];
}) {
  const portfolioData = buildBalanceData(cashflow, walletBalances);
  const currentBalance = walletBalances.reduce((total, wallet) => total + numberValue(wallet.curr_balance), 0);
  const monthlyNet = cashflow.reduce((total, point) => total + numberValue(point.income) - numberValue(point.expense), 0);
  const firstValue = portfolioData[0]?.value ?? currentBalance;
  const highValue = Math.max(currentBalance, ...portfolioData.map((point) => point.value));
  const lowValue = Math.min(currentBalance, ...portfolioData.map((point) => point.value));
  const change = firstValue ? ((currentBalance - firstValue) / Math.abs(firstValue)) * 100 : 0;
  const referencePoint = portfolioData[Math.floor(portfolioData.length / 2)];

  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-stretch gap-5">
        <div className="mb-5">
          <h1 className="text-base text-muted-foreground font-medium mb-1">Current Balance</h1>
          <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-3.5">
            <span className="text-4xl font-bold">{formatCurrency(currentBalance, currency)}</span>
            <div className="flex items-center gap-1 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">{change >= 0 ? "+" : ""}{change.toFixed(1)}%</span>
              <span className="text-muted-foreground font-normal">Selected month</span>
            </div>
          </div>
        </div>

        <div className="grow">
          <div className="flex items-center justify-between flex-wrap gap-2.5 text-sm mb-2.5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Monthly net:</span>
                <span className="font-semibold">{formatCurrency(monthlyNet, currency)}</span>
                <div className="flex items-center gap-1 text-emerald-600">
                  <TrendingUp className="w-3 h-3" />
                  <span>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-muted-foreground">
              <span>
                High: <span className="text-sky-600 font-medium">{formatCurrency(highValue, currency)}</span>
              </span>
              <span>
                Low: <span className="text-yellow-600 font-medium">{formatCurrency(lowValue, currency)}</span>
              </span>
              <span>
                Change: <span className="text-red-600 font-medium">{change.toFixed(2)}%</span>
              </span>
            </div>
          </div>

          {portfolioData.length === 0 ? (
            <EmptyState title="No balance trend yet" body="Approved cashflow will build this chart." />
          ) : (
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={portfolioData}
                  margin={{
                    top: 20,
                    right: 10,
                    left: 5,
                    bottom: 20,
                  }}
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartConfig.value.color} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={chartConfig.value.color} stopOpacity={0} />
                    </linearGradient>
                    <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="10" cy="10" r="1" fill="var(--input)" fillOpacity="0.3" />
                    </pattern>
                    <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="rgba(0,0,0,0.8)" />
                    </filter>
                    <filter id="lineShadow" x="-100%" y="-100%" width="300%" height="300%">
                      <feDropShadow dx="4" dy="6" stdDeviation="25" floodColor="rgba(59, 130, 246, 0.9)" />
                    </filter>
                  </defs>

                  <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" style={{ pointerEvents: "none" }} />

                  <CartesianGrid
                    strokeDasharray="4 8"
                    stroke="var(--input)"
                    strokeOpacity={1}
                    horizontal={true}
                    vertical={false}
                  />

                  {referencePoint ? (
                    <ReferenceLine x={referencePoint.date} stroke={chartConfig.value.color} strokeDasharray="4 4" strokeWidth={1} />
                  ) : null}

                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: chartConfig.value.color }}
                    tickMargin={15}
                    interval="preserveStartEnd"
                    tickCount={5}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: chartConfig.value.color }}
                    tickFormatter={(value) => formatCurrency(Number(value), currency)}
                    tickMargin={15}
                    width={90}
                  />

                  <Tooltip
                    content={<BalanceTooltip currency={currency} />}
                    cursor={{ strokeDasharray: "3 3", stroke: "var(--muted-foreground)", strokeOpacity: 0.5 }}
                  />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={chartConfig.value.color}
                  strokeWidth={2}
                  filter="url(#lineShadow)"
                  dot={(props: { cx?: number; cy?: number; payload?: BalancePoint }) => {
                    const { cx, cy, payload } = props;
                    if (!payload || cx === undefined || cy === undefined) return <g />;
                    if (payload.date === referencePoint?.date || payload.value === highValue || payload.value === lowValue) {
                      return (
                        <circle
                          key={`dot-${payload.date}`}
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={chartConfig.value.color}
                          stroke="white"
                          strokeWidth={2}
                          filter="url(#dotShadow)"
                        />
                      );
                    }

                    return <g key={`dot-${payload.date}`} />;
                  }}
                  activeDot={{
                    r: 6,
                    fill: chartConfig.value.color,
                    stroke: "white",
                    strokeWidth: 2,
                    filter: "url(#dotShadow)",
                  }}
                />
              </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsView({
  summary,
  cashflow = [],
  spending = [],
  walletBalances = [],
  spendingCategories = [],
  spendingTags = [],
  monthLabel = "Current Period",
  canGoNext = false,
  onNextMonth = () => {},
  onPreviousMonth = () => {},
}: {
  summary: AnalyticsSummary | null;
  cashflow: CashflowPoint[];
  spending?: SpendingPoint[];
  walletBalances?: WalletBalance[];
  spendingCategories?: any[];
  spendingTags?: any[];
  monthLabel?: string;
  canGoNext?: boolean;
  onNextMonth?: () => void;
  onPreviousMonth?: () => void;
}) {
  const effectiveSpending = spending.length > 0 ? spending : (spendingCategories as SpendingPoint[]);
  const cashMax = maxAmount(cashflow);
  const spendMax = maxAmount(effectiveSpending);
  const currency = walletBalances[0]?.currency || "IDR";

  return (
    <div className="grid gap-5">
      <BalanceTrendChart cashflow={cashflow} currency={currency} walletBalances={walletBalances} />

      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Approved basis</p>
            <h3 className="section-title">{monthLabel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-compact grid h-9 w-9 place-items-center px-0" onClick={onPreviousMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="btn-compact grid h-9 w-9 place-items-center px-0"
              onClick={onNextMonth}
              disabled={!canGoNext}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
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
            <span className="text-sm text-[#F5FEFD]/46">{cashflow.length} days</span>
          </div>
          <div className="grid gap-3">
            {cashflow.length === 0 ? <EmptyState title="No cashflow" body="Approve income and expense transactions first." /> : null}
            {cashflow.map((point) => (
              <div key={point.day} className="rounded bg-[#1B2326]/42 p-3">
                <div className="flex justify-between text-sm">
                  <span>{dateLabel(point.day)}</span>
                  <span>{amount(Number(point.income) - Number(point.expense))}</span>
                </div>
                <div className="mt-3 grid gap-1">
                  <div className="h-2 rounded bg-[#273538]/90">
                    <div className="h-full rounded bg-[#7DD3FC]" style={{ width: `${Math.max(4, (Number(point.income) / cashMax) * 100)}%` }} />
                  </div>
                  <div className="h-2 rounded bg-[#273538]/90">
                    <div className="h-full rounded bg-[#F6C177]" style={{ width: `${Math.max(4, (Number(point.expense) / cashMax) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <h3 className="section-title">Spending by category</h3>
            <span className="text-sm text-[#F5FEFD]/46">{spending.length}</span>
          </div>
          <div className="grid gap-3">
            {spending.length === 0 ? <EmptyState title="No spending data" body="Expense categories appear after approval." /> : null}
            {spending.map((point) => (
              <div key={point.id ?? "uncategorized"} className="rounded bg-[#1B2326]/42 p-3">
                <div className="flex justify-between text-sm">
                  <span>{point.name ?? "Uncategorized"}</span>
                  <span>{amount(point.amount)}</span>
                </div>
                <div className="mt-3 h-2 rounded bg-[#273538]/90">
                  <div className="h-full rounded bg-[#A7B8BB]" style={{ width: `${Math.max(4, (Number(point.amount) / spendMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="panel-head">
          <h3 className="section-title">Wallet balances</h3>
          <span className="text-sm text-[#F5FEFD]/46">{walletBalances.length}</span>
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
