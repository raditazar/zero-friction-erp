import type { AnalyticsSummary, CashflowPoint, SpendingPoint } from "@/lib/api";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { amount } from "../formatters";
import { EmptyState } from "@/components/ui/feedback";

// MetricCard Component
function MetricCard({ title, value, subtext }: { title: string; value: React.ReactNode; subtext?: string }) {
  return (
    <Card className="bg-white rounded-xl shadow-xs border-[#E8E6E1]">
      <CardContent className="p-5 flex flex-col gap-1.5">
        <h4 className="text-sm font-medium text-[#6E6D7A]">{title}</h4>
        <div className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-[#1A1A1A]">
          {value}
        </div>
        {subtext && <p className="text-xs text-gray-600">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

// AppCard Component
function AppCard({ title, children, rightAction }: { title: string; children: React.ReactNode; rightAction?: React.ReactNode }) {
  return (
    <Card className="bg-white rounded-xl shadow-xs border border-[#E8E6E1] flex flex-col h-full">
      <CardHeader className="px-5 py-4 border-b border-[#E8E6E1] flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-[#1A1A1A]">{title}</CardTitle>
        {rightAction}
      </CardHeader>
      <CardContent className="p-5 flex-1 min-h-[300px] flex flex-col justify-center">
        {children}
      </CardContent>
    </Card>
  );
}

// Cashflow Trend Chart
function CashflowTrendChart({ cashflow }: { cashflow: CashflowPoint[] }) {
  if (!cashflow || cashflow.length === 0) {
    return <EmptyState title="Belum ada data" description="Tidak ada aktivitas pada periode ini." />;
  }
  
  const data = cashflow.map(c => ({
    date: new Intl.DateTimeFormat("id-ID", { month: "short", day: "numeric" }).format(new Date(c.day)),
    income: Number(c.income ?? 0),
    expense: Number(c.expense ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E6E1" />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6E6D7A" }} tickMargin={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6E6D7A" }} tickFormatter={(val) => `Rp${(val/1000).toFixed(0)}k`} />
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: '1px solid #E8E6E1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          labelStyle={{ color: '#6E6D7A', marginBottom: '4px' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [<span key="val" className="font-mono tabular-nums">{amount(value as number)}</span>, undefined]}
          cursor={{ fill: '#F4F3EE' }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="income" name="Pemasukan" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Expense Distribution Chart
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

function ExpenseDistributionChart({ spending }: { spending: SpendingPoint[] }) {
  if (!spending || spending.length === 0) {
    return <EmptyState title="Belum ada data" description="Kategori pengeluaran kosong." />;
  }

  const data = spending.map(s => ({
    name: s.name || 'Lainnya',
    value: Number(s.amount ?? 0)
  })).filter(d => d.value > 0);

  if (data.length === 0) {
    return <EmptyState title="Belum ada data pengeluaran" description="Tidak ada pengeluaran pada periode ini." />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: '1px solid #E8E6E1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [<span key="val" className="font-mono tabular-nums">{amount(value as number)}</span>, undefined]}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Smart Insight Card
function SmartInsightCard({ summary, spending }: { summary: AnalyticsSummary | null, spending: SpendingPoint[] }) {
  const inc = Number(summary?.income ?? 0);
  const exp = Number(summary?.expense ?? 0);
  const net = Number(summary?.net_cashflow ?? 0);
  
  let insight = "Belum ada aktivitas keuangan yang cukup untuk memberikan insight pada periode ini.";
  if (inc > 0 || exp > 0) {
    if (exp > inc) {
      insight = "⚠️ Peringatan: Pengeluaran Anda melebihi pemasukan (Defisit). Pertimbangkan untuk mengevaluasi pengeluaran non-esensial dan menyesuaikan budget.";
    } else {
      const rate = ((net / inc) * 100).toFixed(1);
      insight = `💡 Tingkat tabungan (Savings Rate) Anda sehat di angka ${rate}%. Teruskan kebiasaan baik ini untuk mencapai target keuangan Anda.`;
    }

    if (spending.length > 0) {
      const validSpending = spending.filter(s => Number(s.amount) > 0);
      if (validSpending.length > 0) {
        const topCategory = validSpending.reduce((prev, current) => (Number(prev.amount) > Number(current.amount) ? prev : current));
        insight += ` Pengeluaran paling dominan Anda saat ini ada pada kategori "${topCategory.name ?? "Lainnya"}" sebesar ${amount(topCategory.amount)}.`;
      }
    }
  }

  return (
    <div className="bg-[#111827] text-white rounded-xl p-6 shadow-lg relative overflow-hidden border border-[#374151]">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <h3 className="text-xs font-semibold text-gray-600 mb-2.5 uppercase tracking-widest flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        Smart Insight
      </h3>
      <p className="text-sm sm:text-base leading-relaxed relative z-10 text-gray-200">{insight}</p>
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
    <div className="grid gap-6">
      <SmartInsightCard summary={summary} spending={spendingCategories} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Pemasukan" value={<span className="text-emerald-600">{amount(inc)}</span>} />
        <MetricCard title="Total Pengeluaran" value={<span className="text-rose-600">{amount(exp)}</span>} />
        <MetricCard title="Arus Kas Bersih" value={<span className={net >= 0 ? "text-emerald-600" : "text-rose-600"}>{amount(net)}</span>} />
        <MetricCard title="Savings Rate" value={<span>{savingsRate.toFixed(1)}%</span>} subtext="Sisa penghasilan yg ditabung" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
