import { useMemo } from "react";
import type {
  AnalyticsSummary,
  CashflowPoint,
  Category,
  SpendingPoint,
  Transaction,
  Wallet,
  WalletBalance,
} from "@/lib/api";
import { Fact } from "@/components/ui/dashboard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Inbox,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { amount, cx } from "../formatters";
import { CoinStack, coinsForCashflow } from "@/components/three/coin-stack";
import { CountUp } from "../count-up";
import { WalletStrip } from "../wallet-strip";
import { InboxSwipeStack } from "../inbox-swipe-stack";
import type { Decision } from "@/lib/use-deferred-decisions";

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function maxAmount(points: Array<{ amount?: string | number; income?: string | number; expense?: string | number }>) {
  return Math.max(
    1,
    ...points.map((point) => Math.max(numberValue(point.amount), numberValue(point.income), numberValue(point.expense)))
  );
}

function pct(value: string | number | null | undefined, max: number) {
  return `${Math.max(4, Math.min(100, (numberValue(value) / max) * 100))}%`;
}

function formatYAxis(val: number) {
  if (val === 0) return "0";
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${(val / 1_000).toFixed(0)}k`;
  }
  return `Rp ${val}`;
}

function MetricSummaryCard({
  title,
  amountDisplay,
  subtext,
  icon: Icon,
  statusBadge,
  onClick,
  className,
}: {
  title: string;
  amountDisplay: string;
  subtext?: string;
  icon: React.ElementType;
  statusBadge?: { label: string; isPositive?: boolean };
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cx("group flex flex-col justify-between bg-card text-ink border border-line shadow-xs rounded-2xl p-4 sm:p-5 cursor-pointer hover:border-line-strong hover:bg-paper transition-all duration-200 min-w-0", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono font-medium tracking-wider text-ink-soft uppercase truncate">
          {title}
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-paper text-ink group-hover:bg-paper-sunk transition-colors">
          <Icon className="h-4 w-4 text-ink" />
        </div>
      </div>

      <div className="mt-3">
        <h4 className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-ink tabular-nums truncate">
          {amountDisplay}
        </h4>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5">
          {subtext ? (
            <p className="text-xs text-ink-soft truncate">{subtext}</p>
          ) : null}
          {statusBadge ? (
            <span
              className={cx(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono font-medium shrink-0",
                statusBadge.isPositive
                  ? "bg-positive-soft text-positive border border-positive-line"
                  : "bg-negative-soft text-negative border border-negative-line"
              )}
            >
              {statusBadge.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{statusBadge.label}</span>
            </span>
          ) : (
            <span className="text-xs text-ink-soft group-hover:text-ink inline-flex items-center gap-0.5 font-medium transition-colors">
              Lihat <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CashflowChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-line bg-card p-3 shadow-md text-xs z-50">
      <p className="font-semibold text-ink mb-2">{label}</p>
      <div className="space-y-1.5">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
          <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-ink-soft">{entry.name}:</span>
            </div>
            <span className="font-mono font-semibold text-ink">
              {amount(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardView({
  summary,
  cashflow = [],
  spending = [],
  spendingCategories = [],
  walletBalances = [],
  inbox = [],
  inboxCount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  recentTransactions = [],
  walletById = new Map(),
  categoryById = new Map(),
  ready = { status: "ok" },
  deadLetterCount = 0,
  busy = false,
  onReview = () => {},
  onAnalytics = () => {},
  onNewTransaction = () => {},
  onTransfer = () => {},
  onOpenWallet = () => {},
  onScanReceipt = () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectInbox = () => {},
  onDecide = () => {},
  onEdit = () => {},
  error = "",
  onRetry,
}: {
  summary: AnalyticsSummary | null;
  cashflow?: CashflowPoint[];
  spending?: SpendingPoint[];
  spendingCategories?: SpendingPoint[];
  walletBalances?: WalletBalance[];
  inbox?: Transaction[];
  /** Pending count after local (undo-window) decisions; defaults to the summary count. */
  inboxCount?: number;
  recentTransactions?: Transaction[];
  walletById?: Map<string, Wallet>;
  categoryById?: Map<string, Category>;
  ready?: { status: string; database?: string } | null;
  deadLetterCount?: number;
  busy?: boolean;
  onReview?: () => void;
  onAnalytics?: () => void;
  onNewTransaction?: () => void;
  onTransfer?: () => void;
  onOpenWallet?: (walletId: string) => void;
  onScanReceipt?: () => void;
  onSelectInbox?: () => void;
  onDecide?: (transaction: Transaction, decision: Decision) => void;
  onEdit?: (transaction: Transaction) => void;
  error?: string;
  onRetry?: () => void;
}) {
  const rawSpending = spending.length > 0 ? spending : (spendingCategories as SpendingPoint[]);
  const totalBalance = walletBalances.reduce((total, wallet) => total + numberValue(wallet.curr_balance), 0);
  const spendMax = maxAmount(rawSpending);
  const topInbox = inbox.slice(0, 3);
  const topSpending = rawSpending.slice(0, 5);
  const totalSpendingSum = rawSpending.reduce((acc, curr) => acc + numberValue(curr.amount), 0) || spendMax;
  const net = numberValue(summary?.net_cashflow);
  const forecastExpense = numberValue(summary?.forecast.expense);
  const readyCount = inboxCount ?? summary?.inbox.count ?? inbox.length;
  const pendingAmount = numberValue(summary?.inbox.amount);

  const chartData = useMemo(() => {
    if (!cashflow || cashflow.length === 0) return [];
    return cashflow.map((point) => {
      let dateStr = point.day;
      try {
        const parsed = new Date(point.day);
        if (!isNaN(parsed.getTime())) {
          dateStr = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(parsed);
        }
      } catch {
        dateStr = point.day;
      }
      return {
        day: point.day,
        date: dateStr,
        income: numberValue(point.income),
        expense: numberValue(point.expense),
      };
    });
  }, [cashflow]);

  if (busy && !summary) return <LoadingState variant="dashboard" label="Memuat ringkasan" />;
  if (error && !summary) return <ErrorState title="Ringkasan belum tersedia" message={error} onRetry={onRetry} />;

  return (
    <div className="grid gap-5 w-full max-w-full min-w-0">
      {error ? <ErrorState title="Sebagian ringkasan belum diperbarui" message={error} onRetry={onRetry} /> : null}

      {/* Saldo: the coin stack deliberately pokes out past the card's right edge. */}
      <section
        aria-label="Total saldo"
        className="relative w-full min-w-0 rounded-3xl border border-line bg-card p-5 shadow-xs sm:p-6"
      >
        <div className="min-w-0 pr-28 sm:pr-48">
          <p className="eyebrow">Total saldo</p>
          <p className="font-display mt-2 truncate text-[clamp(1.75rem,8vw,3rem)] font-semibold leading-none text-ink">
            <CountUp value={totalBalance} format={amount} />
          </p>
          <p className="mt-3 text-sm text-ink-soft">
            {walletBalances.length} dompet
            <span className="mx-1.5 text-ink-faint">/</span>
            <span className={net >= 0 ? "font-semibold text-positive" : "font-semibold text-negative"}>
              {net >= 0 ? "+" : "-"}{amount(Math.abs(net))}
            </span>{" "}
            bulan ini
          </p>
          <button
            type="button"
            onClick={onTransfer}
            className="mt-2 inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-ink hover:text-ink-soft"
          >
            Lihat dompet
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <CoinStack
          count={coinsForCashflow(numberValue(summary?.income), numberValue(summary?.expense))}
          ready={Boolean(summary)}
          className="absolute -right-4 -top-6 bottom-0 w-36 sm:-right-5 sm:-top-8 sm:w-48"
        />
      </section>

      <WalletStrip balances={walletBalances} walletById={walletById} onOpen={onOpenWallet} onAll={onTransfer} />

      {/* Ringkasan metrik: 2 kolom di mobile (kartu ketiga melebar), 3 kolom di desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4.5 w-full min-w-0">
        <MetricSummaryCard
          title="Kotak Masuk (Review)"
          amountDisplay={`${readyCount.toLocaleString("id-ID")} transaksi`}
          subtext="Draf transaksi baru"
          icon={Inbox}
          onClick={onReview}
        />
        <MetricSummaryCard
          title="Nominal Tertunda"
          amountDisplay={amount(pendingAmount)}
          subtext="Menunggu persetujuan"
          icon={Clock}
          onClick={onReview}
        />
        <MetricSummaryCard
          title="Arus Kas Bersih"
          amountDisplay={amount(net)}
          subtext={net >= 0 ? "Surplus bulan ini" : "Defisit bulan ini"}
          icon={net >= 0 ? TrendingUp : TrendingDown}
          statusBadge={{
            label: net >= 0 ? "Positif" : "Negatif",
            isPositive: net >= 0,
          }}
          onClick={onAnalytics}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Grafik Tren Arus Kas Interaktif & Kategori Pengeluaran Teratas */}
      <div className="grid gap-5 xl:grid-cols-3 w-full min-w-0">
        {/* Tren Arus Kas Recharts Area Chart */}
        <div className="xl:col-span-2 rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-line">
            <div>
              <p className="eyebrow">Aktivitas Keuangan</p>
              <h3 className="section-title">Tren Arus Kas Harian</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-positive-solid" />
                  <span className="text-ink-soft">Pemasukan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-negative-solid" />
                  <span className="text-ink-soft">Pengeluaran</span>
                </div>
              </div>
              <button
                onClick={onAnalytics}
                className="text-xs font-semibold text-ink hover:text-ink-soft inline-flex items-center gap-1 transition-colors"
              >
                <span>Analitik</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-4 w-full min-w-0">
            {chartData.length === 0 ? (
              <div className="py-12 flex items-center justify-center">
                <EmptyState
                  title="Belum ada data arus kas"
                  description="Pemasukan dan pengeluaran akan muncul setelah transaksi disetujui."
                />
              </div>
            ) : (
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-income)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--chart-income)" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-expense)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--chart-expense)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "var(--chart-neutral)" }}
                      tickMargin={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "var(--chart-neutral)" }}
                      tickFormatter={formatYAxis}
                    />
                    <Tooltip content={<CashflowChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Pemasukan"
                      stroke="var(--chart-income)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#incomeGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Pengeluaran"
                      stroke="var(--chart-expense)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#expenseGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Kartu Kategori Pengeluaran Teratas (Top Spending) */}
        <div className="rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div>
                <p className="eyebrow">Distribusi</p>
                <h3 className="section-title">Pengeluaran Teratas</h3>
              </div>
              <span className="rounded-full bg-paper-sunk px-2 py-0.5 text-xs font-mono font-medium text-ink">
                {topSpending.length} Kategori
              </span>
            </div>

            <div className="pt-4 space-y-4">
              {topSpending.length === 0 ? (
                <EmptyState
                  title="Belum ada pengeluaran"
                  description="Pengeluaran terverifikasi akan muncul di sini."
                />
              ) : (
                topSpending.map((point, index) => {
                  const amt = numberValue(point.amount);
                  const share = totalSpendingSum > 0 ? ((amt / totalSpendingSum) * 100).toFixed(1) : "0.0";
                  const barWidth = spendMax > 0 ? Math.max(4, Math.min(100, (amt / spendMax) * 100)) : 0;
                  return (
                    <div key={point.id ?? `spend-${index}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span className="font-medium text-ink truncate">
                            {point.name || "Tanpa Kategori"}
                          </span>
                          <span className="text-xs font-mono font-medium text-ink-soft bg-paper-sunk px-1.5 py-0.5 rounded shrink-0">
                            {share}%
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-ink shrink-0">
                          {amount(amt)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-paper-sunk overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {topSpending.length > 0 ? (
            <div className="pt-4 mt-4 border-t border-line flex items-center justify-between text-xs text-ink-soft">
              <span>Total pengeluaran tercatat</span>
              <span className="font-mono font-bold text-ink">
                {amount(totalSpendingSum)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Kotak Masuk Staging Preview & Ringkasan Bulan Berjalan */}
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr] w-full min-w-0">
        <InboxSwipeStack
          items={topInbox}
          total={readyCount}
          walletById={walletById}
          categoryById={categoryById}
          onDecide={onDecide}
          onEdit={onEdit}
          onOpenAll={onReview}
        />

        {/* Ringkasan Bulan Ini & Status Sistem */}
        <div className="space-y-5 min-w-0">
          {/* Bulan Ini Snapshot */}
          <div className="rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-xs min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-line mb-4">
              <div>
                <p className="eyebrow">Basis Disetujui</p>
                <h3 className="section-title">Bulan Ini</h3>
              </div>
              <button className="btn-secondary text-xs py-1.5 px-3" onClick={onAnalytics}>
                Buka Analitik
              </button>
            </div>

            {summary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <Fact label="Pemasukan" value={amount(summary.income)} />
                  <Fact label="Pengeluaran" value={amount(summary.expense)} />
                  <Fact label="Prakiraan" value={amount(forecastExpense)} />
                </div>
                <div className="rounded-xl border border-line bg-paper p-3.5">
                  <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <span className="text-ink-soft">Arah Arus Kas</span>
                    <span
                      className={cx(
                        "font-mono font-bold",
                        net >= 0 ? "text-positive" : "text-negative"
                      )}
                    >
                      {net >= 0 ? "Surplus (Positif)" : "Defisit (Negatif)"}
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full rounded-full bg-paper-sunk overflow-hidden">
                    <div
                      className={cx("h-full rounded-full transition-all duration-300", net >= 0 ? "bg-positive-solid" : "bg-negative-solid")}
                      style={{
                        width: pct(
                          Math.abs(net),
                          Math.max(numberValue(summary.income), numberValue(summary.expense), 1)
                        ),
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Belum ada ringkasan bulanan"
                description="Setujui transaksi untuk membangun snapshot bulanan."
              />
            )}
          </div>

          {/* Postur Sistem */}
          <div className="rounded-2xl border border-line bg-card p-4 sm:p-6 shadow-xs min-w-0">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
              <h3 className="section-title text-sm">Status Sistem</h3>
              <span
                className={cx(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium",
                  ready?.status === "ok"
                    ? "bg-positive-soft text-positive border border-positive-line"
                    : "bg-negative-soft text-negative border border-negative-line"
                )}
              >
                {ready?.status === "ok" ? "Operasional" : ready?.status ?? "Tidak Diketahui"}
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2.5">
              <Fact label="Database" value={ready?.database ?? "ok"} />
              <Fact label="Dompet Aktif" value={`${walletBalances.length}`} />
              <Fact label="Dead Letters" value={`${deadLetterCount}`} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
