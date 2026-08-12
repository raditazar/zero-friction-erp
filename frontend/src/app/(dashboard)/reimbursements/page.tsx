"use client";

import { useEffect, useState } from "react";
import { ReimbursementsView } from "@/components/dashboard/views/ReimbursementsView";
import { api, type Category, type Transaction, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { toast } from "@/components/ui/toast";

export default function ReimbursementsPage() {
  const [reimbursements, setReimbursements] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setLoading(true);
    setError("");
    Promise.all([api.reimbursements(), api.wallets(), api.categories()])
      .then(([reimbData, walletData, catData]) => {
        setReimbursements(reimbData);
        setWallets(walletData);
        setCategories(catData);
      })
      .catch((loadError) => {
        console.error(loadError);
        setError("Piutang tidak dapat dimuat. Periksa koneksi lalu coba lagi.");
      })
      .finally(() => setLoading(false));
  }

  async function handleSettle(id: string) {
    if (actionId) return;
    setActionId(id);
    setError("");
    try {
      await api.settleReimbursement(id);
      toast.success("Piutang berhasil dilunasi.");
      loadData();
    } catch (err) {
      console.error("Gagal melunasi reimbursement:", err);
      const msg = err instanceof Error ? err.message : "Pelunasan belum tersimpan. Coba lagi.";
      setError(msg);
      toast.error("Gagal melunasi piutang", { detail: msg });
    } finally {
      setActionId(null);
    }
  }

  async function handleMark(id: string) {
    if (actionId) return;
    setActionId(id);
    setError("");
    try {
      await api.markReimbursement(id);
      toast.success("Transaksi berhasil ditandai sebagai piutang.");
      loadData();
    } catch (err: unknown) {
      console.error("Status piutang belum diubah. Coba lagi.", err);
      const msg = err instanceof Error ? err.message : "Status piutang belum diubah. Coba lagi.";
      setError(msg);
      toast.error("Gagal menandai piutang", { detail: msg });
    } finally {
      setActionId(null);
    }
  }

  const walletById = new Map(wallets.map((w) => [w.id, w]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader />
      <ReimbursementsView
        reimbursements={reimbursements}
        walletById={walletById}
        categoryById={categoryById}
        onMark={handleMark}
        onSettle={handleSettle}
        loading={loading}
        error={error}
        actionId={actionId}
        onRetry={loadData}
      />
    </div>
  );
}
