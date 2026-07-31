"use client";

import { useEffect, useState } from "react";
import { DashboardView } from "@/components/dashboard/views/DashboardView";
import { api, type AnalyticsSummary, type CashflowPoint, type Transaction } from "@/lib/api";

export default function OverviewPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [spendingCategories, setSpendingCategories] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  function loadOverview() {
    setBusy(true);
    Promise.all([
      api.analyticsSummary(),
      api.analyticsCashflow(),
      api.analyticsSpendingByCategory(),
      api.transactions(),
    ])
      .then(([summaryData, cashflowData, catData, txData]) => {
        setSummary(summaryData);
        setCashflow(cashflowData);
        setSpendingCategories(catData as any);
        setRecentTransactions(txData.data.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  return (
    <div className="p-6 bg-[#FBF9F5] min-h-screen">
      <DashboardView
        summary={summary}
        cashflow={cashflow}
        spendingCategories={spendingCategories as any}
        recentTransactions={recentTransactions}
        onSelectInbox={() => {
          window.location.href = "/inbox";
        }}
      />
    </div>
  );
}
