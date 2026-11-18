"use client";

import { useMemo } from "react";
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
import { useDeferredDecisions } from "@/lib/use-deferred-decisions";

async function fetchOverview() {
  const [summary, cashflow, spendingCategories, txData, inbox, wallets, categories, walletBalances] =
    await Promise.all([
      api.analyticsSummary(),
      api.analyticsCashflow(),
      api.analyticsSpendingByCategory(),
      api.transactions(),
      api.inbox(),
      api.wallets(),
      api.categories(),
      api.analyticsWalletBalances(),
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
  const { hidden, decide } = useDeferredDecisions<Transaction>({
    commit: (transaction, decision) =>
      decision === "approve" ? api.approveTransaction(transaction.id) : api.rejectTransaction(transaction.id),
    describe: (transaction, decision) =>
      `${transaction.merchant || "Transaksi"} ${decision === "approve" ? "disetujui" : "ditolak"}`,
    onSettled: () => void revalidateFinance(),
  });
  const visibleInbox = useMemo(() => inbox.filter((transaction) => !hidden.has(transaction.id)), [inbox, hidden]);
  const busy = isLoading || (isValidating && !data);
  const error = loadError && !data ? "Ringkasan dashboard tidak dapat dimuat. Periksa koneksi lalu coba lagi." : "";

  function loadOverview() {
    return revalidateFinance();
  }

  return (
    <div className="page-shell">
      <MobilePageHeader />
      <DashboardView
        summary={summary}
        cashflow={cashflow}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        spendingCategories={spendingCategories as any}
        recentTransactions={recentTransactions}
        inbox={visibleInbox}
        inboxCount={visibleInbox.length}
        walletBalances={walletBalances}
        walletById={new Map(wallets.map((wallet) => [wallet.id, wallet]))}
        categoryById={new Map(categories.map((cat) => [cat.id, cat]))}
        busy={busy}
        error={error}
        onRetry={loadOverview}
        onReview={() => router.push("/inbox")}
        onAnalytics={() => router.push("/analytics")}
        onNewTransaction={() => router.push("/transactions?action=new")}
        onTransfer={() => router.push("/wallets")}
        onOpenWallet={(id) => router.push(`/wallets?wallet=${id}`)}
        onScanReceipt={() => router.push("/inbox")}
        onSelectInbox={() => router.push("/inbox")}
        onDecide={decide}
        onEdit={(transaction) => router.push(`/inbox?selected=${transaction.id}`)}
      />
    </div>
  );
}
