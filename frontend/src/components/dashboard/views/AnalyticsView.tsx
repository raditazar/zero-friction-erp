import type { AnalyticsSummary, CashflowPoint, SpendingPoint } from "@/lib/api";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { amount, compactTick } from "../formatters";
import { EmptyState } from "@/components/ui/feedback";
import { Sparkles } from "lucide-react";

// MetricCard Component
function MetricCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: React.ReactNode;
  subtext?: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-line p-3.5 sm:p-4.5 shadow-xs flex flex-col justify-between min-w-0">
      <div>
        <h4 className="text-xs font-medium text-ink-soft truncate">{title}</h4>
        <div className="mt-1 text-lg sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-ink truncate">
          {value}
        </div>
      </div>
      {subtext && <p className="mt-1 text-xs text-ink-soft leading-tight truncate">{subtext}</p>}
    </div>
  );
}

// AppCard Component
function AppCard({
  title,
  children,
  rightAction,
}: {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl shadow-xs border border-line flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-line flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-semibold text-ink">{title}</h3>
        {rightAction}
      </div>
      <div className="p-3 sm:p-5 flex-1 flex flex-col justify-center min-w-0">
        {children}
      </div>
    </div>
  );
}

// Cashflow Trend Chart
function CashflowTrendChart({ cashflow }: { cashflow: CashflowPoint[] }) {
  if (!cashflow || cashflow.length === 0) {
    return <EmptyState title="Belum ada data" description="Tidak ada aktivitas pada periode ini." />;
  }

  const data = cashflow.map((c) => ({
    date: new Intl.DateTimeFormat("id-ID", { month: "short", day: "numeric" }).format(new Date(c.day)),
    income: Number(c.income ?? 0),
    expense: Number(c.expense ?? 0),
  }));

  return (
    // pan-y: vertical swipes scroll the page, horizontal ones move the tooltip between days.
    <div className="h-[240px] w-full select-none sm:h-[280px]" style={{ touchAction: "pan-y" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--chart-neutral)" }} tickMargin={8} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--chart-neutral)" }}
            tickFormatter={compactTick}
            width={48}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--card-raised)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              fontSize: "12px",
            }}
            labelStyle={{ color: "var(--chart-neutral)", marginBottom: "4px", fontWeight: 500 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [<span key="val" className="font-mono tabular-nums font-semibold">{amount(value as number)}</span>, undefined]}
            cursor={{ fill: "var(--paper-sunk)" }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
          <Bar dataKey="income" name="Pemasukan" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="expense" name="Pengeluaran" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Expense Distribution: a donut on wide screens, a stacked bar with a list on phones.
const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6366F1", "#14B8A6"];

function ExpenseDistributionChart({ spending }: { spending: SpendingPoint[] }) {
  if (!spending || spending.length === 0) {
    return <EmptyState title="Belum ada data" description="Kategori pengeluaran kosong." />;
  }

  const data = spending
    .map((s) => ({
      name: s.name || "Lainnya",
      value: Number(s.amount ?? 0),
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return <EmptyState title="Belum ada data pengeluaran" description="Tidak ada pengeluaran pada periode ini." />;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <>
    <div className="space-y-4 md:hidden">
      <div className="flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label="Pembagian pengeluaran per kategori">
        {sorted.map((item, index) => (
          <span
            key={item.name}
            style={{ width: `${(item.value / total) * 100}%`, backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((item, index) => (
          <li key={item.name} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
            <span className="shrink-0 text-xs text-ink-soft tabular-nums">{Math.round((item.value / total) * 100)}%</span>
            <span className="w-28 shrink-0 text-right font-semibold tabular-nums text-ink">{amount(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="hidden h-[240px] w-full sm:h-[280px] md:block">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--card-raised)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              fontSize: "12px",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [<span key="val" className="font-mono tabular-nums font-semibold">{amount(value as number)}</span>, undefined]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
    </>
  );
}

// Smart Insight Card
function SmartInsightCard({ summary, spending }: { summary: AnalyticsSummary | null; spending: SpendingPoint[] }) {
  const inc = Number(summary?.income ?? 0);
  const exp = Number(summary?.expense ?? 0);
  const net = Number(summary?.net_cashflow ?? 0);

  let statusBadge = "Stabil";
  let badgeColorClass = "bg-paper text-ink-soft border-line";
  let insightText = "Belum cukup transaksi di periode ini untuk dirangkum.";
  let detailText = "";

  if (inc > 0 || exp > 0) {
    if (exp > inc) {
      statusBadge = "Defisit";
      badgeColorClass = "bg-negative-soft text-negative border-negative-line";
      insightText = "Pengeluaran lebih besar dari pemasukan di periode ini.";
      detailText = "Coba cek pengeluaran yang bisa ditunda dan sesuaikan anggaran supaya seimbang lagi.";
    } else {
      const rate = ((net / inc) * 100).toFixed(1);
      statusBadge = "Sehat";
      badgeColorClass = "bg-positive-soft text-positive border-positive-line";
      insightText = `Kamu menyisihkan ${rate}% dari pemasukan.`;
      detailText = "Arus kas sedang baik. Pertahankan supaya cadangan terus bertambah.";
    }

    if (spending.length > 0) {
      const validSpending = spending.filter((s) => Number(s.amount) > 0);
      if (validSpending.length > 0) {
        const topCategory = validSpending.reduce((prev, current) =>
          Number(prev.amount) > Number(current.amount) ? prev : current
        );
        detailText += ` Pengeluaran terbesar ada di ${topCategory.name ?? "Lainnya"}: ${amount(topCategory.amount)}.`;
      }
    }
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-xs w-full max-w-full min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-paper border border-line rounded-lg p-1.5 text-ink flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-ink" />
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-ink">Ringkasan</h3>
        </div>
        <span className={`text-xs sm:text-xs font-medium px-2.5 py-0.5 rounded-full border ${badgeColorClass}`}>
          {statusBadge}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-xs sm:text-sm leading-relaxed">
        <p className="font-semibold text-ink">{insightText}</p>
        {detailText && <p className="text-ink-soft">{detailText}</p>}
      </div>
    </div>
  );
}

export function AnalyticsView({
  summary,
  cashflow = [],
  spendingCategories = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  spendingTags = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  monthLabel = "",
}: {
  summary: AnalyticsSummary | null;
  cashflow: CashflowPoint[];
  spendingCategories?: SpendingPoint[];
  spendingTags?: SpendingPoint[];
  monthLabel?: string;
}) {
  const inc = Number(summary?.income ?? 0);
  const exp = Number(summary?.expense ?? 0);
  const net = Number(summary?.net_cashflow ?? 0);
  const savingsRate = inc > 0 ? (net / inc) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-full min-w-0">
      <SmartInsightCard summary={summary} spending={spendingCategories} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full min-w-0">
        <MetricCard title="Total Pemasukan" value={<span className="text-positive">{amount(inc)}</span>} />
        <MetricCard title="Total Pengeluaran" value={<span className="text-negative">{amount(exp)}</span>} />
        <MetricCard
          title="Arus Kas Bersih"
          value={<span className={net >= 0 ? "text-positive" : "text-negative"}>{amount(net)}</span>}
        />
        <MetricCard
          title="Porsi ditabung"
          value={<span>{savingsRate.toFixed(1)}%</span>}
          subtext="Sisa penghasilan yg ditabung"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full min-w-0">
        <AppCard title="Tren Arus Kas">
          <CashflowTrendChart cashflow={cashflow} />
        </AppCard>

        <AppCard title="Ke mana uangnya">
          <ExpenseDistributionChart spending={spendingCategories} />
        </AppCard>
      </div>
    </div>
  );
}
