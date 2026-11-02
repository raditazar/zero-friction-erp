"use client";

import { useState } from "react";
import useSWR from "swr";
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
import { KEYS, revalidateFinance } from "@/lib/swr";

async function fetchOverview() {
  const [summary, cashflow, spendingCategories, txData, inbox, wallets, categories, walletBalances, ready] =
    await Promise.all([
      api.analyticsSummary(),
      api.analyticsCashflow(),
      api.analyticsSpendingByCategory(),
      api.transactions(),
      api.inbox(),
      api.wallets(),
      api.categories(),
      api.analyticsWalletBalances(),
      api.ready(),
    ]);
  return {
    summary,
    cashflow,
    spendingCategories,
    recentTransactions: txData.data.slice(0, 5),
    inbox,
    wallets,
    categories,
    walletBalances,
    ready,
  };
}

const EMPTY_TX: Transaction[] = [];
const EMPTY_WALLETS: Wallet[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_BALANCES: WalletBalance[] = [];
const EMPTY_CASHFLOW: CashflowPoint[] = [];

export default function OverviewPage() {
  const router = useRouter();
  const { data, error: loadError, isLoading, isValidating } = useSWR(KEYS.overview, fetchOverview, {
    refreshInterval: 60_000,
    refreshWhenHidden: false,
  });
  const summary: AnalyticsSummary | null = data?.summary ?? null;
  const cashflow = data?.cashflow ?? EMPTY_CASHFLOW;
  const spendingCategories = (data?.spendingCategories ?? []) as unknown as { id: string; name: string; amount: number }[];
  const recentTransactions = data?.recentTransactions ?? EMPTY_TX;
  const inbox = data?.inbox ?? EMPTY_TX;
  const wallets = data?.wallets ?? EMPTY_WALLETS;
  const categories = data?.categories ?? EMPTY_CATEGORIES;
  const walletBalances = data?.walletBalances ?? EMPTY_BALANCES;
  const ready = data?.ready ?? null;
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const busy = isLoading || (isValidating && !data);
  const error = loadError && !data ? "Ringkasan dashboard tidak dapat dimuat. Periksa koneksi lalu coba lagi." : "";

  function loadOverview() {
    return revalidateFinance();
  }

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
