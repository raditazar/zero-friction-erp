"use client";

import { useEffect, useState } from "react";
import { DashboardView } from "@/components/dashboard/views/DashboardView";
import { api, type AnalyticsSummary, type CashflowPoint, type Transaction, type Wallet, type WalletBalance } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";


export default function OverviewPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [spendingCategories, setSpendingCategories] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [inbox, setInbox] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [ready, setReady] = useState<{ status: string; database?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function loadOverview() {
    setBusy(true);
    setError("");
    Promise.all([
      api.analyticsSummary(),
      api.analyticsCashflow(),
      api.analyticsSpendingByCategory(),
      api.transactions(),
      api.inbox(),
      api.wallets(),
      api.analyticsWalletBalances(),
      api.ready(),
    ])
      .then(([summaryData, cashflowData, catData, txData, inboxData, walletData, balanceData, readyData]) => {
        setSummary(summaryData);
        setCashflow(cashflowData);
        setSpendingCategories(catData as any);
        setRecentTransactions(txData.data.slice(0, 5));
        setInbox(inboxData);
        setWallets(walletData);
        setWalletBalances(balanceData);
        setReady(readyData);
      })
      .catch((loadError) => {
        console.error(loadError);
        setError("Ringkasan dashboard tidak dapat dimuat. Periksa koneksi lalu coba lagi.");
      })
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    loadOverview();
  }, []);

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader />
      <DashboardView
        summary={summary}
        cashflow={cashflow}
        spendingCategories={spendingCategories as any}
        recentTransactions={recentTransactions}
        inbox={inbox}
        walletBalances={walletBalances}
        walletById={new Map(wallets.map((wallet) => [wallet.id, wallet]))}
        ready={ready}
        busy={busy}
        error={error}
        onRetry={loadOverview}
        onSelectInbox={() => {
          window.location.href = "/inbox";
        }}
      />
    </div>
  );
}
