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
import { Fact, Pill } from "@/components/ui/dashboard";
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
  Wallet as WalletIcon,
  Plus,
  Scan,
  ArrowLeftRight,
  CheckCircle2,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { amount, cx, shortID } from "../formatters";

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
}: {
  title: string;
  amountDisplay: string;
  subtext?: string;
  icon: React.ElementType;
  statusBadge?: { label: string; isPositive?: boolean };
  onClick?: () => void;
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
      className="group flex flex-col justify-between bg-white text-[#1A1A1A] border border-[#E8E6E1] shadow-xs rounded-2xl p-4 sm:p-5 cursor-pointer hover:border-[#D5D3CC] hover:bg-[#FAF9F6] transition-all duration-200 min-w-0"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono font-medium tracking-wider text-[#6E6D7A] uppercase truncate">
          {title}
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F4F3EE] text-[#1A1A1A] group-hover:bg-[#E8E6E1] transition-colors">
          <Icon className="h-4 w-4 text-[#1A1A1A]" />
        </div>
      </div>

      <div className="mt-3">
        <h4 className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-[#1A1A1A] tabular-nums truncate">
          {amountDisplay}
        </h4>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#F0EEE9] pt-2.5">
          {subtext ? (
            <p className="text-xs text-[#6E6D7A] truncate">{subtext}</p>
          ) : null}
          {statusBadge ? (
            <span
              className={cx(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono font-medium shrink-0",
                statusBadge.isPositive
                  ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                  : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
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
            <span className="text-xs text-[#6E6D7A] group-hover:text-[#1A1A1A] inline-flex items-center gap-0.5 font-medium transition-colors">
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
    <div className="rounded-xl border border-[#E8E6E1] bg-white p-3 shadow-md text-xs z-50">
      <p className="font-semibold text-[#1A1A1A] mb-2">{label}</p>
      <div className="space-y-1.5">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
          <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-[#6E6D7A]">{entry.name}:</span>
            </div>
            <span className="font-mono font-semibold text-[#1A1A1A]">
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
  selected,
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
  onScanReceipt = () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectInbox = () => {},
  onSelect = () => {},
  onApprove = () => {},
  onReject = () => {},
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
  selected?: Transaction;
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
  onScanReceipt?: () => void;
  onSelectInbox?: () => void;
  onSelect?: (id: string) => void;
  onApprove?: (transaction: Transaction) => void | Promise<void>;
  onReject?: (transaction: Transaction) => void | Promise<void>;
  onEdit?: (transaction: Transaction) => void;
  error?: string;
  onRetry?: () => void;
}) {
  const rawSpending = spending.length > 0 ? spending : (spendingCategories as SpendingPoint[]);
  const totalBalance = walletBalances.reduce((total, wallet) => total + numberValue(wallet.curr_balance), 0);
  const spendMax = maxAmount(rawSpending);
  const topInbox = inbox.slice(0, 4);
  const topSpending = rawSpending.slice(0, 5);
  const totalSpendingSum = rawSpending.reduce((acc, curr) => acc + numberValue(curr.amount), 0) || spendMax;
  const net = numberValue(summary?.net_cashflow);
  const forecastExpense = numberValue(summary?.forecast.expense);
  const readyCount = summary?.inbox.count ?? inbox.length;
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

  if (busy && !summary) return <LoadingState variant="metric" label="Memuat ringkasan dashboard..." />;
  if (error && !summary) return <ErrorState title="Ringkasan belum tersedia" message={error} onRetry={onRetry} />;

  return (
    <div className="grid gap-5 w-full max-w-full min-w-0">
      {error ? <ErrorState title="Sebagian ringkasan belum diperbarui" message={error} onRetry={onRetry} /> : null}

      {/* Baris Aksi Cepat (Quick Action Bar) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E8E6E1] shadow-xs w-full min-w-0">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A]">Dashboard Keuangan</h2>
          <p className="text-xs text-[#6E6D7A]">Ringkasan operasional, verifikasi transaksi draf, dan arus kas akun aktif.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={onNewTransaction}
            className="btn-primary inline-flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ Catat Transaksi</span>
          </button>
          <button
            onClick={onScanReceipt}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3.5"
          >
            <Scan className="h-4 w-4 text-[#6E6D7A]" />
            <span>Scan Struk (OCR)</span>
          </button>
          <button
            onClick={onTransfer}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3.5"
          >
            <ArrowLeftRight className="h-4 w-4 text-[#6E6D7A]" />
            <span>Transfer Antar Dompet</span>
          </button>
        </div>
      </div>

      {/* 4 Ringkasan Metrik Utama (Grid 2x2 di Mobile, 4 Kolom di Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5 w-full min-w-0">
        <MetricSummaryCard
          title="Kotak Masuk (Review)"
          amountDisplay={`${readyCount.toLocaleString("id-ID")} items`}
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
        />
        <MetricSummaryCard
          title="Total Saldo Dompet"
          amountDisplay={amount(totalBalance)}
          subtext={`${walletBalances.length} dompet aktif`}
          icon={WalletIcon}
          onClick={onTransfer}
        />
      </div>

      {/* Grafik Tren Arus Kas Interaktif & Kategori Pengeluaran Teratas */}
      <div className="grid gap-5 xl:grid-cols-3 w-full min-w-0">
        {/* Tren Arus Kas Recharts Area Chart */}
        <div className="xl:col-span-2 rounded-2xl border border-[#E8E6E1] bg-white p-4 sm:p-6 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#F0EEE9]">
            <div>
              <p className="eyebrow">Aktivitas Keuangan</p>
              <h3 className="section-title">Tren Arus Kas Harian</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                  <span className="text-[#6E6D7A]">Pemasukan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                  <span className="text-[#6E6D7A]">Pengeluaran</span>
                </div>
              </div>
              <button
                onClick={onAnalytics}
                className="text-xs font-semibold text-[#1A1A1A] hover:text-[#6E6D7A] inline-flex items-center gap-1 transition-colors"
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
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E6E1" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#6E6D7A" }}
                      tickMargin={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#6E6D7A" }}
                      tickFormatter={formatYAxis}
                    />
                    <Tooltip content={<CashflowChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Pemasukan"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#incomeGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Pengeluaran"
                      stroke="#EF4444"
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
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 sm:p-6 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#F0EEE9]">
              <div>
                <p className="eyebrow">Distribusi</p>
                <h3 className="section-title">Pengeluaran Teratas</h3>
              </div>
              <span className="rounded-full bg-[#F0EEE9] px-2 py-0.5 text-xs font-mono font-medium text-[#1A1A1A]">
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
                          <span className="font-medium text-[#1A1A1A] truncate">
                            {point.name || "Tanpa Kategori"}
                          </span>
                          <span className="text-[10px] font-mono font-medium text-[#6E6D7A] bg-[#F0EEE9] px-1.5 py-0.5 rounded shrink-0">
                            {share}%
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-[#1A1A1A] shrink-0">
                          {amount(amt)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#F0EEE9] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#1A1A1A] transition-all duration-300"
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
            <div className="pt-4 mt-4 border-t border-[#F0EEE9] flex items-center justify-between text-xs text-[#6E6D7A]">
              <span>Total pengeluaran tercatat</span>
              <span className="font-mono font-bold text-[#1A1A1A]">
                {amount(totalSpendingSum)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Kotak Masuk Staging Preview & Ringkasan Bulan Berjalan */}
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr] w-full min-w-0">
        {/* Kotak Masuk Preview */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 sm:p-6 shadow-xs min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#F0EEE9] mb-4">
            <div>
              <p className="eyebrow">Staging & Verifikasi</p>
              <h3 className="section-title">Kotak Masuk (Perlu Ditinjau)</h3>
            </div>
            <button
              className="btn-secondary text-xs sm:text-sm py-1.5 px-3 inline-flex items-center gap-1"
              onClick={onReview}
            >
              <span>Buka Kotak Masuk</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-2.5">
            {topInbox.length === 0 ? (
              <EmptyState
                title="Kotak masuk bersih"
                description="Semua draf transaksi telah ditinjau."
              />
            ) : null}
            {topInbox.map((transaction) => {
              const isSelected = selected?.id === transaction.id;
              const walletName = walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id);
              const categoryName = categoryById.get(transaction.category_id ?? "")?.name ?? "Tanpa Kategori";

              return (
                <button
                  key={transaction.id}
                  onClick={() => onSelect(transaction.id)}
                  className={cx(
                    "w-full rounded-xl p-3.5 text-left transition-all border outline-none min-w-0 focus-visible:ring-2 focus-visible:ring-[#1A1A1A]",
                    isSelected
                      ? "border-[#1A1A1A] bg-[#F0EEE9] shadow-xs"
                      : "border-[#E8E6E1] bg-white hover:bg-[#F0EEE9] shadow-xs"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                        {transaction.merchant || "Transaksi Tanpa Nama"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#6E6D7A]">
                        {walletName} • {categoryName}
                      </p>
                    </div>
                    <span
                      className={cx(
                        "text-sm font-mono font-bold shrink-0",
                        transaction.type === "income" ? "text-[#059669]" : "text-[#1A1A1A]"
                      )}
                    >
                      {transaction.type === "income" ? "+" : ""}
                      {amount(transaction.amount)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Pill>{transaction.type}</Pill>
                    <Pill>{transaction.input_source ?? "manual"}</Pill>
                    {transaction.ai_confidence ? (
                      <span className="rounded-md bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 text-[11px] font-mono font-medium text-[#047857]">
                        AI{" "}
                        {typeof transaction.ai_confidence === "number"
                          ? `${Math.round(transaction.ai_confidence * 100)}%`
                          : transaction.ai_confidence}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="mt-4 rounded-xl border border-[#E8E6E1] bg-[#F9F8F5] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6E6D7A]">
                    Draf Dipilih
                  </span>
                  <p className="mt-0.5 truncate text-sm font-bold text-[#1A1A1A]">
                    {selected.merchant || "Transaksi Tanpa Nama"}
                  </p>
                </div>
                <span className="text-sm font-mono font-extrabold text-[#1A1A1A]">
                  {amount(selected.amount)}
                </span>
              </div>
              {selected.raw_input || selected.note ? (
                <p className="mt-2.5 line-clamp-2 text-xs text-[#6E6D7A] bg-white p-2.5 rounded-lg border border-[#E8E6E1] font-mono">
                  {selected.raw_input || selected.note}
                </p>
              ) : null}
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
                  disabled={busy}
                  onClick={() => onApprove(selected)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Setujui</span>
                </button>
                <button
                  className="btn-secondary text-xs py-1.5 px-3"
                  disabled={busy}
                  onClick={() => onEdit(selected)}
                >
                  Koreksi
                </button>
                <button
                  className="btn-danger text-xs py-1.5 px-3"
                  disabled={busy}
                  onClick={() => onReject(selected)}
                >
                  Tolak
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Ringkasan Bulan Ini & Status Sistem */}
        <div className="space-y-5 min-w-0">
          {/* Bulan Ini Snapshot */}
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 sm:p-6 shadow-xs min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#F0EEE9] mb-4">
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
                <div className="rounded-xl border border-[#E8E6E1] bg-[#F9F8F5] p-3.5">
                  <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <span className="text-[#6E6D7A]">Arah Arus Kas</span>
                    <span
                      className={cx(
                        "font-mono font-bold",
                        net >= 0 ? "text-[#059669]" : "text-[#DC2626]"
                      )}
                    >
                      {net >= 0 ? "Surplus (Positif)" : "Defisit (Negatif)"}
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full rounded-full bg-[#E8E6E1] overflow-hidden">
                    <div
                      className={cx("h-full rounded-full transition-all duration-300", net >= 0 ? "bg-[#10B981]" : "bg-[#EF4444]")}
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
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 sm:p-6 shadow-xs min-w-0">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EEE9] mb-3">
              <h3 className="section-title text-sm">Status Sistem</h3>
              <span
                className={cx(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium",
                  ready?.status === "ok"
                    ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                    : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
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
