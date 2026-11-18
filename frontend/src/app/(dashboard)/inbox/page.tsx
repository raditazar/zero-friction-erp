"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReviewView } from "@/components/dashboard/views/ReviewView";
import { AllocationDialog } from "@/components/dashboard/dialogs";
import { api, type Transaction, type TransactionPayload } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { toast } from "@/components/ui/toast";
import { openCapture } from "@/lib/capture-bus";
import { revalidateFinance, useCategories, useInbox, useWallets } from "@/lib/swr";
import { useDeferredDecisions } from "@/lib/use-deferred-decisions";

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const { data: inboxData, mutate: mutateInbox, isLoading: inboxLoading } = useInbox();
  const { data: walletData } = useWallets();
  const { data: categoryData } = useCategories();
  const inbox = useMemo(() => inboxData ?? [], [inboxData]);
  const wallets = useMemo(() => walletData ?? [], [walletData]);
  const categories = useMemo(() => categoryData ?? [], [categoryData]);

  const searchParams = useSearchParams();
  const preselectId = searchParams.get("id") ?? searchParams.get("selected") ?? "";
  const [selectedId, setSelectedId] = useState<string>(preselectId);
  const [busy, setBusy] = useState(false);

  // DEC-13 Income Split Dialog State
  const [incomeAllocationTx, setIncomeAllocationTx] = useState<Transaction | null>(null);
  const [lastDecision, setLastDecision] = useState(1);

  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  /** Optimistically drop `id` from the inbox, run `action`, roll back on failure, then refresh balances/budgets. */
  async function resolveOptimistically(id: string, action: () => Promise<unknown>) {
    await mutateInbox(
      async (current) => {
        await action();
        return (current ?? []).filter((t) => t.id !== id);
      },
      {
        optimisticData: (current) => (current ?? []).filter((t) => t.id !== id),
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      },
    );
    void revalidateFinance();
  }

  // Approve/reject leave the list at once and only hit the API after the 5s undo window.
  const { hidden, decide } = useDeferredDecisions<Transaction>({
    commit: async (transaction, decision) => {
      if (decision === "reject") return api.rejectTransaction(transaction.id);
      await api.approveTransaction(transaction.id);
      // Approved income goes straight to the split dialog.
      if (transaction.type === "income") setIncomeAllocationTx(transaction);
    },
    describe: (transaction, decision) =>
      `${transaction.merchant || "Transaksi"} ${decision === "approve" ? "disetujui" : "ditolak"}`,
    onSettled: () => void revalidateFinance(),
  });
  const visibleInbox = useMemo(() => inbox.filter((transaction) => !hidden.has(transaction.id)), [inbox, hidden]);
  // Fall back to the first pending item when nothing is selected or the selected one left the inbox.
  const selected = useMemo(
    () => visibleInbox.find((t) => t.id === selectedId) ?? visibleInbox[0],
    [visibleInbox, selectedId],
  );

  async function handleSaveEdit(transaction: Transaction, draft: Partial<Transaction>) {
    setBusy(true);
    try {
      let updatedTx: Transaction | undefined;
      await resolveOptimistically(transaction.id, async () => {
        updatedTx = await api.patchTransaction(transaction.id, {
          ...draft,
          status: "approved",
        } as unknown as TransactionPayload);
      });
      if (draft.type === "income" || transaction.type === "income") {
        setIncomeAllocationTx(updatedTx || { ...transaction, ...draft, status: "approved" });
      }
      toast.success("Perubahan transaksi berhasil disimpan.");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal menyimpan edit transaksi.";
      toast.error("Gagal menyimpan edit transaksi", { detail: errMsg });
      console.error("Gagal menyimpan edit transaksi:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <MobilePageHeader primaryCta={{ label: "Catat", onClick: () => openCapture("photo") }} />
      <ReviewView
        inbox={visibleInbox}
        selected={selected}
        wallets={wallets}
        categories={categories}
        walletById={walletById}
        categoryById={categoryById}
        busy={busy}
        loading={inboxLoading}
        onSelect={setSelectedId}
        lastDecision={lastDecision}
        onApprove={(transaction) => {
          setLastDecision(1);
          decide(transaction, "approve");
        }}
        onReject={(transaction) => {
          setLastDecision(-1);
          decide(transaction, "reject");
        }}
        onSaveEdit={handleSaveEdit}
      />

      {/* DEC-13 Income Split Dialog */}
      <AllocationDialog
        open={Boolean(incomeAllocationTx)}
        transaction={incomeAllocationTx}
        onOpenChange={(open) => {
          if (!open) setIncomeAllocationTx(null);
        }}
        onConfirm={() => setIncomeAllocationTx(null)}
        busy={busy}
      />
    </div>
  );
}
