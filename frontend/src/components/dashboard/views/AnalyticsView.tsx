import type { AnalyticsSummary, CashflowPoint, SpendingPoint } from "@/lib/api";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { amount } from "../formatters";
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
    <div className="bg-white rounded-2xl border border-[#E8E6E1] p-3.5 sm:p-4.5 shadow-xs flex flex-col justify-between min-w-0">
      <div>
        <h4 className="text-xs font-medium text-[#756F64] truncate">{title}</h4>
        <div className="mt-1 text-lg sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-[#1A1A1A] truncate">
          {value}
        </div>
      </div>
      {subtext && <p className="mt-1 text-[11px] text-[#756F64] leading-tight truncate">{subtext}</p>}
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
    <div className="bg-white rounded-2xl shadow-xs border border-[#E8E6E1] flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#E8E6E1] flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-semibold text-[#1A1A1A]">{title}</h3>
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
    <div className="w-full h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E6E1" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#756F64" }} tickMargin={8} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#756F64" }}
            tickFormatter={(val) => `Rp${(val / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #E8E6E1",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#756F64", marginBottom: "4px", fontWeight: 500 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [<span key="val" className="font-mono tabular-nums font-semibold">{amount(value as number)}</span>, undefined]}
            cursor={{ fill: "#FAF9F5" }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
          <Bar dataKey="income" name="Pemasukan" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Expense Distribution Chart
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

  return (
    <div className="w-full h-[240px] sm:h-[280px]">
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
              border: "1px solid #E8E6E1",
              backgroundColor: "#FFFFFF",
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
  );
}

// Smart Insight Card
function SmartInsightCard({ summary, spending }: { summary: AnalyticsSummary | null; spending: SpendingPoint[] }) {
  const inc = Number(summary?.income ?? 0);
  const exp = Number(summary?.expense ?? 0);
  const net = Number(summary?.net_cashflow ?? 0);

  let statusBadge = "Stabil";
  let badgeColorClass = "bg-[#FAF9F5] text-[#756F64] border-[#E8E6E1]";
  let insightText = "Belum ada aktivitas keuangan yang cukup untuk memberikan analisis wawasan pada periode ini.";
  let detailText = "";

  if (inc > 0 || exp > 0) {
    if (exp > inc) {
      statusBadge = "Defisit";
      badgeColorClass = "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]";
      insightText = "Pengeluaran Anda melebihi pemasukan (Defisit) pada periode ini.";
      detailText = "Pertimbangkan untuk mengevaluasi pengeluaran non-esensial dan menyesuaikan budget agar arus kas kembali seimbang.";
    } else {
      const rate = ((net / inc) * 100).toFixed(1);
      statusBadge = "Arus Kas Sehat";
      badgeColorClass = "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]";
      insightText = `Tingkat tabungan (Savings Rate) Anda berada di angka ${rate}%.`;
      detailText = "Kondisi arus kas Anda berada di jalur yang baik. Pertahankan rasio tabungan ini untuk memperkuat cadangan finansial masa depan.";
    }

    if (spending.length > 0) {
      const validSpending = spending.filter((s) => Number(s.amount) > 0);
      if (validSpending.length > 0) {
        const topCategory = validSpending.reduce((prev, current) =>
          Number(prev.amount) > Number(current.amount) ? prev : current
        );
        detailText += ` Pengeluaran paling dominan tercatat pada kategori "${topCategory.name ?? "Lainnya"}" sebesar ${amount(topCategory.amount)}.`;
      }
    }
  }

  return (
    <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 sm:p-5 shadow-xs w-full max-w-full min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-[#FAF9F5] border border-[#E8E6E1] rounded-lg p-1.5 text-[#1A1A1A] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-[#1A1A1A]">Analisis Cerdas &amp; Rekomendasi</h3>
        </div>
        <span className={`text-[11px] sm:text-xs font-medium px-2.5 py-0.5 rounded-full border ${badgeColorClass}`}>
          {statusBadge}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-xs sm:text-sm leading-relaxed">
        <p className="font-semibold text-[#1A1A1A]">{insightText}</p>
        {detailText && <p className="text-[#756F64]">{detailText}</p>}
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
        <MetricCard title="Total Pemasukan" value={<span className="text-emerald-600">{amount(inc)}</span>} />
        <MetricCard title="Total Pengeluaran" value={<span className="text-rose-600">{amount(exp)}</span>} />
        <MetricCard
          title="Arus Kas Bersih"
          value={<span className={net >= 0 ? "text-emerald-600" : "text-rose-600"}>{amount(net)}</span>}
        />
        <MetricCard
          title="Savings Rate"
          value={<span>{savingsRate.toFixed(1)}%</span>}
          subtext="Sisa penghasilan yg ditabung"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full min-w-0">
        <AppCard title="Tren Arus Kas">
          <CashflowTrendChart cashflow={cashflow} />
        </AppCard>

        <AppCard title="Distribusi Pengeluaran">
          <ExpenseDistributionChart spending={spendingCategories} />
        </AppCard>
      </div>
    </div>
  );
}
