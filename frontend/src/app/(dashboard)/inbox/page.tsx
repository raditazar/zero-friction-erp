"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { ReviewView } from "@/components/dashboard/views/ReviewView";
import { AllocationDialog } from "@/components/dashboard/dialogs";
import { api, type Category, type Transaction, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { toast } from "@/components/ui/toast";


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
    toast.info("Memproses ekstraksi transaksi dengan AI...");
    try {
      const res = await api.extractTransaction(aiText);
      const msg = `Berhasil diekstrak oleh ${res.provider}. Transaksi masuk ke Kotak Masuk.`;
      setAiNotice(msg);
      toast.success(msg);
      setAiText("");
      loadData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Gagal mengekstrak teks.";
      setAiNotice(errMsg);
      toast.error("Gagal mengekstrak teks", { detail: errMsg });
    } finally {
      setBusy(false);
    }
  }

  async function handleExtractImage(file: File) {
    setBusy(true);
    const noticeText = "Memproses OCR Struk dengan Gemini...";
    setAiNotice(noticeText);
    toast.info(noticeText);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Url = reader.result as string;
          const base64Data = base64Url.split(",")[1];
          const mimeType = file.type || "image/jpeg";
          const res = await api.extractTransaction({
            image_base64: base64Data,
            image_mime: mimeType,
          });
          const successMsg = `Berhasil diekstrak dari foto struk (${res.transaction?.merchant || "Transaksi"}). Masuk ke Kotak Masuk.`;
          setAiNotice(successMsg);
          toast.success(successMsg);
          loadData();
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Gagal mengekstrak struk.";
          setAiNotice(errMsg);
          toast.error("Gagal mengekstrak struk", { detail: errMsg });
        } finally {
          setBusy(false);
        }
      };
      reader.onerror = () => {
        const errMsg = "Gagal membaca berkas gambar.";
        setAiNotice(errMsg);
        toast.error("Gagal membaca berkas gambar", { detail: errMsg });
        setBusy(false);
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Gagal membaca berkas gambar.";
      setAiNotice(errMsg);
      toast.error("Gagal membaca berkas gambar", { detail: errMsg });
      setBusy(false);
    }
  }

  async function handleApprove(transaction: Transaction) {
    setBusy(true);
    try {
      await api.approveTransaction(transaction.id);
      toast.success("Transaksi berhasil disetujui.");
      // DEC-13: If approving an Income transaction, auto-trigger Income Split Dialog
      if (transaction.type === "income") {
        setIncomeAllocationTx(transaction);
      }
      loadData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal menyetujui transaksi.";
      toast.error("Gagal menyetujui transaksi", { detail: errMsg });
      console.error("Gagal menyetujui transaksi:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(transaction: Transaction) {
    setBusy(true);
    try {
      await api.rejectTransaction(transaction.id);
      toast.success("Transaksi berhasil ditolak.");
      loadData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal menolak transaksi.";
      toast.error("Gagal menolak transaksi", { detail: errMsg });
      console.error("Gagal menolak transaksi:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(transaction: Transaction, draft: Partial<Transaction>) {
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedTx = await api.patchTransaction(transaction.id, {
        ...draft,
        status: "approved",
      } as any);
      if (draft.type === "income" || transaction.type === "income") {
        setIncomeAllocationTx(updatedTx || { ...transaction, ...draft, status: "approved" });
      }
      toast.success("Perubahan transaksi berhasil disimpan.");
      loadData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal menyimpan edit transaksi.";
      toast.error("Gagal menyimpan edit transaksi", { detail: errMsg });
      console.error("Gagal menyimpan edit transaksi:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3 sm:p-6 bg-[#F7F6F2] min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
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
        onExtractImage={handleExtractImage}
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
