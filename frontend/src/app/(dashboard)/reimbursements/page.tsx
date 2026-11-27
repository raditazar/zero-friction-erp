"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ReimbursementsView } from "@/components/dashboard/views/ReimbursementsView";
import { api, type ReimbursementClaim, type SettleReimbursementPayload } from "@/lib/api";
import { revalidateFinance, useCategories, useWallets } from "@/lib/swr";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { toast } from "@/components/ui/toast";

export default function ReimbursementsPage() {
  const router = useRouter();
  const claims = useSWR<ReimbursementClaim[]>("reimbursements", () => api.reimbursements());
  const wallets = useWallets();
  const categories = useCategories();
  const [actionId, setActionId] = useState<string | null>(null);

  /** Runs one claim action; failures are toasts so the list stays on screen. */
  async function runAction(id: string, action: () => Promise<ReimbursementClaim>, success: string, failure: string, movesMoney = false) {
    if (actionId) return false;
    setActionId(id);
    try {
      const updated = await action();
      await claims.mutate((current) => current?.map((claim) => (claim.id === id ? { ...claim, ...updated } : claim)), { revalidate: false });
      if (movesMoney) void revalidateFinance();
      toast.success(success);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Coba lagi.";
      toast.error(failure, { detail: msg });
      return false;
    } finally {
      setActionId(null);
    }
  }

  const handleSettle = (id: string, payload: SettleReimbursementPayload) =>
    runAction(
      id,
      () => api.settleReimbursement(id, payload),
      payload.wallet_id ? "Pelunasan tercatat." : "Klaim ditandai lunas.",
      "Gagal mencatat pelunasan",
      Boolean(payload.wallet_id),
    );

  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const loadError = claims.error || wallets.error;

  return (
    <div className="page-shell">
      <MobilePageHeader />
      <ReimbursementsView
        claims={claims.data ?? []}
        wallets={wallets.data ?? []}
        categoryById={categoryById}
        onSettle={handleSettle}
        onIgnore={(id) => void runAction(id, () => api.ignoreReimbursement(id), "Klaim diabaikan.", "Gagal mengabaikan klaim")}
        onReopen={(id) => void runAction(id, () => api.reopenReimbursement(id), "Klaim dibuka kembali.", "Gagal membuka klaim")}
        onOpenLedger={() => router.push("/transactions")}
        loading={claims.isLoading}
        error={loadError && !claims.data ? "Piutang tidak dapat dimuat. Periksa koneksi lalu coba lagi." : ""}
        actionId={actionId}
        onRetry={() => { void claims.mutate(); void wallets.mutate(); }}
      />
    </div>
  );
}
