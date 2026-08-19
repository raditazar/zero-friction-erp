"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardView } from "@/components/dashboard/views/DashboardView";
import {
  api,
  type AnalyticsSummary,
  type CashflowPoint,
  type Category,
  type Transaction,
  type Wallet,
  type WalletBalance,
} from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

export default function OverviewPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [spendingCategories, setSpendingCategories] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [inbox, setInbox] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [ready, setReady] = useState<{ status: string; database?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
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
      api.categories(),
      api.analyticsWalletBalances(),
      api.ready(),
    ])
      .then(([summaryData, cashflowData, catData, txData, inboxData, walletData, categoriesData, balanceData, readyData]) => {
        setSummary(summaryData);
        setCashflow(cashflowData);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSpendingCategories(catData as any);
        setRecentTransactions(txData.data.slice(0, 5));
        setInbox(inboxData);
        setWallets(walletData);
        setCategories(categoriesData);
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

  const selected = inbox.find((t) => t.id === selectedId);

  async function handleApprove(transaction: Transaction) {
    try {
      await api.approveTransaction(transaction.id);
      setSelectedId(undefined);
      loadOverview();
    } catch (err) {
      console.error("Gagal menyetujui transaksi:", err);
    }
  }

  async function handleReject(transaction: Transaction) {
    try {
      await api.rejectTransaction(transaction.id);
      setSelectedId(undefined);
      loadOverview();
    } catch (err) {
      console.error("Gagal menolak transaksi:", err);
    }
  }

  return (
    <div className="p-3 sm:p-6 bg-[#F7F6F2] min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
      <MobilePageHeader />
      <DashboardView
        summary={summary}
        cashflow={cashflow}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spendingCategories={spendingCategories as any}
        recentTransactions={recentTransactions}
        inbox={inbox}
        selected={selected}
        walletBalances={walletBalances}
        walletById={new Map(wallets.map((wallet) => [wallet.id, wallet]))}
        categoryById={new Map(categories.map((cat) => [cat.id, cat]))}
        ready={ready}
        busy={busy}
        error={error}
        onRetry={loadOverview}
        onReview={() => router.push("/inbox")}
        onAnalytics={() => router.push("/analytics")}
        onNewTransaction={() => router.push("/transactions?action=new")}
        onTransfer={() => router.push("/wallets")}
        onScanReceipt={() => router.push("/inbox")}
        onSelectInbox={() => router.push("/inbox")}
        onSelect={(id) => setSelectedId((prev) => (prev === id ? undefined : id))}
        onApprove={handleApprove}
        onReject={handleReject}
        onEdit={(transaction) => router.push(`/inbox?selected=${transaction.id}`)}
      />
    </div>
  );
}
