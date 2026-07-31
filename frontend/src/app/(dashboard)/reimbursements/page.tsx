"use client";

import { useEffect, useState } from "react";
import { ReimbursementsView } from "@/components/dashboard/views/ReimbursementsView";
import { api, type Category, type Transaction, type Wallet } from "@/lib/api";

export default function ReimbursementsPage() {
  const [reimbursements, setReimbursements] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([api.reimbursements(), api.wallets(), api.categories()])
      .then(([reimbData, walletData, catData]) => {
        setReimbursements(reimbData);
        setWallets(walletData);
        setCategories(catData);
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  async function handleSettle(id: string) {
    setBusy(true);
    try {
      await api.settleReimbursement(id);
      loadData();
    } catch (err) {
      console.error("Gagal melunasi reimbursement:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleMark(id: string) {
    setBusy(true);
    try {
      await api.markReimbursement(id);
      loadData();
    } catch (err) {
      console.error("Gagal menandai piutang:", err);
    } finally {
      setBusy(false);
    }
  }

  const walletById = new Map(wallets.map((w) => [w.id, w]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="p-6 bg-[#FBF9F5] min-h-screen">
      <ReimbursementsView
        reimbursements={reimbursements}
        walletById={walletById}
        categoryById={categoryById}
        onMark={handleMark}
        onSettle={handleSettle}
      />
    </div>
  );
}
