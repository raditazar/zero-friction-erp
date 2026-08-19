"use client";

import { useEffect, useState } from "react";
import { WalletsView } from "@/components/dashboard/views/WalletsView";
import { emptyWallet, DraftWallet, walletCategories } from "@/components/dashboard/model";
import { api, type Wallet, type WalletBalance } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import {
  FormField,
  MoneyField,
  NativeSelectField,
  TextField,
} from "@/components/ui/form";
import { ProviderPicker } from "@/components/ui/provider-picker";
import { CurrencySelect } from "@/components/ui/currency-select";
import { toast } from "@/components/ui/toast";

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Record<string, WalletBalance>>({});
  const [draft, setDraft] = useState<DraftWallet>(emptyWallet);
  const [busy, setBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

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

  function handleOpenNewWallet() {
    setDraft(emptyWallet);
    setSubmitError("");
    setIsFormOpen(true);
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
    setSubmitError("");
    setIsFormOpen(true);
  }

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    if (submitBusy) return;

    if (!draft.name.trim()) {
      setSubmitError("Nama dompet wajib diisi.");
      return;
    }
    if (!draft.category.trim()) {
      setSubmitError("Pilih kategori dompet.");
      return;
    }
    if (!draft.currency.trim()) {
      setSubmitError("Mata uang wajib diisi.");
      return;
    }

    setSubmitError("");
    setSubmitBusy(true);
    try {
      if (draft.id) {
        await api.patchWallet(draft.id, {
          name: draft.name.trim(),
          category: draft.category,
          provider: draft.provider.trim(),
          provider_slug: draft.provider_slug || null,
          account_number: draft.account_number.trim(),
          currency: draft.currency.trim().toUpperCase(),
          init_balance: parseFloat(draft.init_balance) || 0,
        });
        toast.success("Dompet berhasil diperbarui.");
      } else {
        await api.createWallet({
          name: draft.name.trim(),
          category: draft.category,
          provider: draft.provider.trim(),
          provider_slug: draft.provider_slug || null,
          account_number: draft.account_number.trim(),
          currency: draft.currency.trim().toUpperCase() || "IDR",
          init_balance: parseFloat(draft.init_balance) || 0,
        });
        toast.success("Dompet berhasil ditambahkan.");
      }
      setDraft(emptyWallet);
      setIsFormOpen(false);
      loadData();
    } catch (err) {
      console.error("Gagal menyimpan dompet:", err);
      const errMsg = err instanceof Error ? err.message : "Dompet belum tersimpan. Periksa koneksi Anda lalu coba lagi.";
      setSubmitError(errMsg);
      toast.error("Gagal menyimpan dompet", { detail: errMsg });
    } finally {
      setSubmitBusy(false);
    }
  }

  function handleDelete(id: string) {
    setDeleteId(id);
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setBusy(true);
    try {
      await api.deleteWallet(deleteId);
      toast.success("Dompet berhasil dihapus.");
      loadData();
    } catch (err) {
      console.error("Gagal menghapus dompet:", err);
      const errMsg = err instanceof Error ? err.message : "Gagal menghapus dompet.";
      toast.error("Gagal menghapus dompet", { detail: errMsg });
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
    try {
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
      toast.success("Transfer antar dompet berhasil dibuat.");
      loadData();
    } catch (err) {
      console.error("Gagal membuat transfer:", err);
      const errMsg = err instanceof Error ? err.message : "Gagal membuat transfer antar dompet.";
      toast.error("Gagal membuat transfer antar dompet", { detail: errMsg });
      throw err;
    }
  }

  return (
    <div className="p-3 sm:p-6 bg-[#F7F6F2] min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
      <MobilePageHeader />
      <WalletsView
        wallets={wallets}
        balances={balances}
        onOpenNewWallet={handleOpenNewWallet}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTransfer={handleTransfer}
      />

      {/* FormDialog Tambah / Edit Dompet */}
      <FormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setSubmitError("");
        }}
        title={draft.id ? "Edit Dompet" : "Tambah Dompet Baru"}
        description={
          draft.id
            ? "Perbarui informasi rekening, e-wallet, atau kartu Anda."
            : "Tambahkan rekening bank, e-wallet, atau sumber dana baru."
        }
        isSubmitting={submitBusy}
        submitError={submitError}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 py-2">
          <FormField label="Nama Dompet / Rekening" required>
            <TextField
              id="wallet-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="misal: BCA Utama, GoPay, Tabungan Darurat"
              required
            />
          </FormField>

          <FormField label="Penyedia Bank / E-Wallet (idn-finlogos)">
            <ProviderPicker
              valueSlug={draft.provider_slug}
              valueName={draft.provider}
              onChange={({ slug, name }) =>
                setDraft({ ...draft, provider_slug: slug, provider: name })
              }
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Kategori Dompet" required>
              <NativeSelectField
                id="wallet-category"
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                required
              >
                <option value="">Pilih kategori dompet</option>
                {walletCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </NativeSelectField>
            </FormField>

            <FormField label="Mata Uang" required hint="Kode ISO 4217">
              <CurrencySelect
                id="wallet-currency"
                value={draft.currency}
                onValueChange={(currency) => setDraft({ ...draft, currency })}
              />
            </FormField>
          </div>

          <FormField label="Nomor Rekening / Akun (Opsional)">
            <TextField
              id="wallet-account-number"
              value={draft.account_number}
              onChange={(event) => setDraft({ ...draft, account_number: event.target.value })}
              placeholder="misal: 1234567890"
            />
          </FormField>

          <FormField label="Saldo Awal" required hint="Nilai disimpan sebagai Rupiah tanpa pecahan.">
            <MoneyField
              id="wallet-init-balance"
              currency="Rp"
              value={draft.init_balance}
              onValueChange={(init_balance) => setDraft({ ...draft, init_balance })}
              placeholder="0"
            />
          </FormField>
        </div>
      </FormDialog>

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
