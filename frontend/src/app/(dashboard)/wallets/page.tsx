"use client";

import { useEffect, useState } from "react";
import { WalletsView } from "@/components/dashboard/views/WalletsView";
import { emptyWallet, DraftWallet } from "@/components/dashboard/model";
import { api, type Wallet, type WalletBalance } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Record<string, WalletBalance>>({});
  const [draft, setDraft] = useState<DraftWallet>(emptyWallet);
  const [busy, setBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([api.wallets(), api.analyticsWalletBalances()])
      .then(([walletData, balanceData]) => {
        setWallets(walletData);
        const map: Record<string, WalletBalance> = {};
        balanceData.forEach((b) => {
          map[b.wallet_id] = b;
        });
        setBalances(map);
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  async function handleSubmit() {
    if (submitBusy) return;
    setSubmitError("");
    setSubmitBusy(true);
    try {
      if (draft.id) {
        await api.patchWallet(draft.id, {
          name: draft.name,
          category: draft.category,
          provider: draft.provider,
          provider_slug: draft.provider_slug || null,
          account_number: draft.account_number,
          currency: draft.currency,
          init_balance: parseFloat(draft.init_balance) || 0,
        });
      } else {
        await api.createWallet({
          name: draft.name,
          category: draft.category,
          provider: draft.provider,
          provider_slug: draft.provider_slug || null,
          account_number: draft.account_number,
          currency: draft.currency || "IDR",
          init_balance: parseFloat(draft.init_balance) || 0,
        });
      }
      setDraft(emptyWallet);
      loadData();
    } catch (err) {
      console.error("Gagal menyimpan dompet:", err);
      setSubmitError("Dompet belum tersimpan. Periksa koneksi Anda lalu coba lagi.");
    } finally {
      setSubmitBusy(false);
    }
  }

  function handleEdit(wallet: Wallet) {
    setDraft({
      id: wallet.id,
      name: wallet.name,
      category: wallet.category,
      provider: wallet.provider || "",
      provider_slug: wallet.provider_slug || "",
      account_number: wallet.account_number || "",
      account_holder: wallet.account_holder || "",
      currency: wallet.currency,
      init_balance: String(wallet.init_balance),
      is_active: wallet.is_active ?? true,
    });
  }

  function handleDelete(id: string) {
    setDeleteId(id);
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setBusy(true);
    try {
      await api.deleteWallet(deleteId);
      loadData();
    } catch (err) {
      console.error("Gagal menghapus dompet:", err);
    } finally {
      setBusy(false);
      setDeleteId(null);
    }
  }

  async function handleTransfer(payload: {
    wallet_id: string;
    destination_wallet_id: string;
    amount: number;
    admin_fee: number;
    transaction_at?: string;
    note?: string;
  }) {
    await api.createTransfer({
      wallet_id: payload.wallet_id,
      destination_wallet_id: payload.destination_wallet_id,
      amount: payload.amount,
      admin_fee: payload.admin_fee,
      transaction_at: payload.transaction_at,
      note: payload.note,
      status: "approved",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    loadData();
  }

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader />
      <WalletsView
        wallets={wallets}
        balances={balances}
        draft={draft}
        setDraft={setDraft}
        onSubmit={handleSubmit}
        onEdit={handleEdit}
        onDelete={handleDelete}
        submitBusy={submitBusy}
        submitError={submitError}
        onTransfer={handleTransfer}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Dompet Keuangan?"
        description="Hapus dompet ini? Transaksi yang terhubung akan tetap tersimpan."
        variant="danger"
        onConfirm={handleDeleteConfirm}
        isConfirming={busy}
      />
    </div>
  );
}
