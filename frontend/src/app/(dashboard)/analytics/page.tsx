"use client";

import { useEffect, useState } from "react";
import { AnalyticsView } from "@/components/dashboard/views/AnalyticsView";
import { api, type AnalyticsSummary, type CashflowPoint } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";


export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [spendingCategories, setSpendingCategories] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [spendingTags, setSpendingTags] = useState<{ id: string; name: string; amount: number }[]>([]);

  useEffect(() => {
    Promise.all([
      api.analyticsSummary(),
      api.analyticsCashflow(),
      api.analyticsSpendingByCategory(),
      api.analyticsSpendingByTags(),
    ])
      .then(([s, c, cat, tag]) => {
        setSummary(s);
        setCashflow(c);
        setSpendingCategories(cat as any);
        setSpendingTags(tag as any);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="p-6 bg-[#FBF9F5] min-h-screen">
      <MobilePageHeader />
      <AnalyticsView
        summary={summary}
        cashflow={cashflow}
        spendingCategories={spendingCategories as any}
        spendingTags={spendingTags as any}
      />
    </div>
  );
}
