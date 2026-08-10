"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { ReviewView } from "@/components/dashboard/views/ReviewView";
import { AllocationDialog } from "@/components/dashboard/dialogs";
import { api, type Category, type Transaction, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";


export default function InboxPage() {
  const [inbox, setInbox] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiNotice, setAiNotice] = useState("");

  // DEC-13 Income Split Dialog State
  const [incomeAllocationTx, setIncomeAllocationTx] = useState<Transaction | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([api.inbox(), api.wallets(), api.categories()])
      .then(([inboxData, walletData, categoryData]) => {
        setInbox(inboxData);
        setWallets(walletData);
        setCategories(categoryData);
        if (inboxData.length > 0 && !selectedId) {
          setSelectedId(inboxData[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selected = useMemo(() => inbox.find((t) => t.id === selectedId), [inbox, selectedId]);

  async function handleExtract(e: FormEvent) {
    e.preventDefault();
    if (!aiText.trim()) return;
    setBusy(true);
    setAiNotice("");
    try {
      const res = await api.extractTransaction(aiText);
      setAiNotice(`Berhasil diekstrak oleh ${res.provider}. Transaksi masuk ke Kotak Masuk.`);
      setAiText("");
      loadData();
    } catch (err: unknown) {
      setAiNotice(err instanceof Error ? err.message : "Gagal mengekstrak teks.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(transaction: Transaction) {
    setBusy(true);
    try {
      await api.approveTransaction(transaction.id);
      // DEC-13: If approving an Income transaction, auto-trigger Income Split Dialog
      if (transaction.type === "income") {
        setIncomeAllocationTx(transaction);
      }
      loadData();
    } catch (err) {
      console.error("Gagal menyetujui transaksi:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(transaction: Transaction) {
    setBusy(true);
    try {
      await api.rejectTransaction(transaction.id);
      loadData();
    } catch (err) {
      console.error("Gagal menolak transaksi:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(transaction: Transaction, draft: Partial<Transaction>) {
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.patchTransaction(transaction.id, draft as any);
      if (draft.status === "approved") {
        await api.approveTransaction(transaction.id);
        if (transaction.type === "income" || draft.type === "income") {
          setIncomeAllocationTx(transaction);
        }
      }
      loadData();
    } catch (err) {
      console.error("Gagal menyimpan edit transaksi:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader />
      <ReviewView
        inbox={inbox}
        selected={selected}
        wallets={wallets}
        categories={categories}
        walletById={walletById}
        categoryById={categoryById}
        busy={busy}
        aiText={aiText}
        aiNotice={aiNotice}
        onSelect={setSelectedId}
        onAIText={setAiText}
        onExtract={handleExtract}
        onApprove={handleApprove}
        onReject={handleReject}
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
