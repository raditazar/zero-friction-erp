"use client";

import { useEffect, useState } from "react";
import { AnalyticsView } from "@/components/dashboard/views/AnalyticsView";
import { api, type AnalyticsSummary, type CashflowPoint, type SpendingPoint } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { LoadingState, ErrorState } from "@/components/ui/feedback";

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [spendingCategories, setSpendingCategories] = useState<SpendingPoint[]>([]);
  const [spendingTags, setSpendingTags] = useState<SpendingPoint[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: formatDate(firstDay),
      to: formatDate(today)
    };
  });
  const [activePill, setActivePill] = useState("Bulan Ini");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
     
    setError(null);
    Promise.all([
      api.analyticsSummary(dateRange),
      api.analyticsCashflow(dateRange),
      api.analyticsSpendingByCategory(dateRange),
      api.analyticsSpendingByTags(dateRange),
    ])
      .then(([s, c, cat, tag]) => {
        setSummary(s);
        setCashflow(c);
        setSpendingCategories(cat);
        setSpendingTags(tag);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load analytics");
        setIsLoading(false);
      });
  }, [dateRange]);

  const handlePillClick = (pill: string) => {
    setActivePill(pill);
    const today = new Date();
    let from = dateRange.from;
    const to = formatDate(today);
    
    if (pill === "7 Hari") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      from = formatDate(d);
    } else if (pill === "30 Hari") {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      from = formatDate(d);
    } else if (pill === "Bulan Ini") {
      from = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (pill === "YTD") {
      from = formatDate(new Date(today.getFullYear(), 0, 1));
    }
    setDateRange({ from, to });
  };

  return (
    <div className="p-4 sm:p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader />
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">Analytics Dashboard</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-[#E8E6E1] p-1 rounded-lg">
            {["7 Hari", "30 Hari", "Bulan Ini", "YTD"].map((pill) => (
              <button
                key={pill}
                onClick={() => handlePillClick(pill)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activePill === pill ? "bg-white shadow-sm text-black" : "text-[#5A5A5A] hover:text-black"
                }`}
              >
                {pill}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#5A5A5A]">
            <input 
              type="date" 
              value={dateRange.from} 
              onChange={(e) => {
                setDateRange(r => ({ ...r, from: e.target.value }));
                setActivePill("");
              }}
              className="bg-white border border-[#E8E6E1] outline-none focus:border-[#1A1A1A] rounded-md px-3 py-1.5 shadow-sm"
            />
            <span>-</span>
            <input 
              type="date" 
              value={dateRange.to} 
              onChange={(e) => {
                setDateRange(r => ({ ...r, to: e.target.value }));
                setActivePill("");
              }}
              className="bg-white border border-[#E8E6E1] outline-none focus:border-[#1A1A1A] rounded-md px-3 py-1.5 shadow-sm"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Mengambil data untuk periode yang dipilih..." />
      ) : error ? (
        <ErrorState title="Gagal memuat Analytics" message={error} onRetry={() => setDateRange({ ...dateRange })} />
      ) : (
        <AnalyticsView
          summary={summary}
          cashflow={cashflow}
          spendingCategories={spendingCategories}
          spendingTags={spendingTags}
          monthLabel={`${dateRange.from} s/d ${dateRange.to}`}
        />
      )}
    </div>
  );
}
