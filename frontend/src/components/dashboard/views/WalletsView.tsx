"use client";

import { useState, type FormEvent } from "react";
import type { Wallet, WalletBalance } from "@/lib/api";
import type { DraftWallet } from "../model";
import { walletCategories } from "../model";
import { amount } from "../formatters";
import { Panel } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { ActionMenu } from "@/components/ui/action-menu";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogBody,
  AppDialogFooter,
} from "@/components/ui/dialog";
import { ReviewDialog } from "@/components/ui/dialogs/review-dialog";
import {
  FormCard,
  FormCardContent,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
  FormField,
  FormGridItem,
  MoneyField,
  ResponsiveFormGrid,
  SelectField as NativeSelectField,
  SubmitAction,
  TextField,
} from "@/components/ui/form";

type Props = {
  wallets: Wallet[];
  balances: Record<string, WalletBalance>;
  draft: DraftWallet;
  setDraft: (draft: DraftWallet) => void;
  onSubmit: () => Promise<void>;
  onEdit: (wallet: Wallet) => void;
  onDelete: (id: string) => void;
  submitBusy: boolean;
  submitError?: string;
  onTransfer?: (payload: {
    wallet_id: string;
    destination_wallet_id: string;
    amount: number;
    admin_fee: number;
    transaction_at?: string;
    note?: string;
  }) => Promise<void>;
};

export function WalletsView({
  wallets,
  balances,
  draft,
  setDraft,
  onSubmit,
  onEdit,
  onDelete,
  submitBusy,
  submitError,
  onTransfer,
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [destWalletId, setDestWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [adminFee, setAdminFee] = useState("0");
  const [transferDate, setTransferDate] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [reviewTransferOpen, setReviewTransferOpen] = useState(false);

  function validateField(field: keyof Pick<DraftWallet, "name" | "category" | "currency" | "init_balance">) {
    const value = draft[field].trim();
    if (field === "name") return value ? "" : "Nama dompet wajib diisi.";
    if (field === "category") return value ? "" : "Pilih kategori dompet.";
    if (field === "currency") return /^[A-Za-z]{3}$/.test(value) ? "" : "Gunakan kode mata uang 3 huruf, misalnya IDR.";
    if (field === "init_balance") return /^\d+$/.test(value) ? "" : "Masukkan saldo awal dalam angka bulat, termasuk 0 bila belum ada saldo.";
    return "";
  }

  function validateAndSetField(field: keyof Pick<DraftWallet, "name" | "category" | "currency" | "init_balance">) {
    const error = validateField(field);
    setFieldErrors((current) => ({ ...current, [field]: error }));
    return error;
  }

  async function handleWalletSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = ["name", "category", "currency", "init_balance"] as const;
    const errors = Object.fromEntries(fields.map((field) => [field, validateField(field)]));
    setFieldErrors(errors);
    const firstInvalid = fields.find((field) => errors[field]);
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`#wallet-${firstInvalid}`)?.focus();
      return;
    }
    await onSubmit();
  }

  function openTransferModal(defaultSourceId?: string) {
    setSourceWalletId(defaultSourceId || wallets[0]?.id || "");
    setDestWalletId(wallets.find((w) => w.id !== defaultSourceId)?.id || wallets[1]?.id || "");
    setTransferAmount("");
    setAdminFee("0");
    setTransferDate(new Date().toISOString().slice(0, 16));
    setTransferNote("");
    setTransferError("");
    setTransferModalOpen(true);
  }

  async function handleTransferSubmit(e: FormEvent) {
    e.preventDefault();
    setTransferError("");
    const parsedAmount = parseFloat(transferAmount);
    if (!sourceWalletId || !destWalletId) {
      setTransferError("Pilih dompet asal dan dompet tujuan.");
      return;
    }
    if (sourceWalletId === destWalletId) {
      setTransferError("Dompet asal dan tujuan harus berbeda.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransferError("Masukkan nominal transfer yang valid (> 0).");
      return;
    }

    setTransferModalOpen(false);
    setReviewTransferOpen(true);
  }

  async function executeTransfer() {
    setTransferBusy(true);
    try {
      const parsedAmount = parseFloat(transferAmount);
      const parsedFee = parseFloat(adminFee) || 0;
      const transferPayload = {
        wallet_id: sourceWalletId,
        destination_wallet_id: destWalletId,
        amount: parsedAmount,
        admin_fee: parsedFee,
        transaction_at: transferDate ? new Date(transferDate).toISOString() : undefined,
        note: transferNote,
      };
      if (onTransfer) {
        await onTransfer(transferPayload);
      }
      setReviewTransferOpen(false);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : "Gagal melakukan transfer.");
      setReviewTransferOpen(false);
      setTransferModalOpen(true);
    } finally {
      setTransferBusy(false);
    }
  }

  const parsedTransferAmount = parseFloat(transferAmount) || 0;
  const parsedAdminFee = parseFloat(adminFee) || 0;
  
  const sourceWallet = wallets.find((w) => w.id === sourceWalletId);
  const destWallet = wallets.find((w) => w.id === destWalletId);

  const sourceBalance = parseFloat(String(sourceWallet ? (balances[sourceWallet.id]?.curr_balance ?? sourceWallet.init_balance) : 0));
  const destBalance = parseFloat(String(destWallet ? (balances[destWallet.id]?.curr_balance ?? destWallet.init_balance) : 0));

  const reviewTransferItems = [
    {
      id: "source",
      label: `Asal: ${sourceWallet?.name || "-"}`,
      before: sourceBalance,
      after: sourceBalance - parsedTransferAmount - parsedAdminFee,
    },
    {
      id: "dest",
      label: `Tujuan: ${destWallet?.name || "-"}`,
      before: destBalance,
      after: destBalance + parsedTransferAmount,
    },
  ];

  if (parsedAdminFee > 0) {
    reviewTransferItems.push({
      id: "fee",
      label: "Biaya Admin",
      before: 0,
      after: -parsedAdminFee,
    });
  }

  return (
    <InfoTooltipProvider>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Main Wallet Balances Panel */}
        <Panel className="bg-[#F9F8F5] border border-[#E8E6E1] rounded-xl p-6">
          <div className="panel-head mb-6">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="eyebrow text-[#6E6D7A]">Daftar Rekening & E-Wallet</p>
                <InfoTooltip content="Saldo terkini dihitung secara otomatis dari akumulasi transaksi disetujui (DEC-04 & DEC-09)." />
              </div>
              <h3 className="section-title text-[#1A1A1A] text-xl font-bold">
                {wallets.length} Dompet Aktif
              </h3>
            </div>
            <button className="btn-primary" onClick={() => openTransferModal()}>
              + Transfer Antar Dompet
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {wallets.map((wallet) => {
              const balance = balances[wallet.id]?.curr_balance ?? wallet.init_balance;
              return (
                <div
                  key={wallet.id}
                  className="rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-5 shadow-sm hover:border-[#38484E] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-full bg-[#F9F8F5] border border-[#E8E6E1] px-2.5 py-0.5 text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider">
                        {wallet.category}
                      </span>
                      <span className="text-xs text-[#6E6D7A] font-medium">{wallet.provider || "Rekening Utama"}</span>
                    </div>
                    <h4 className="mt-2 text-lg font-bold text-[#1A1A1A]">{wallet.name}</h4>
                    <p className="mt-3 text-2xl font-extrabold text-[#1A1A1A] tabular-nums">
                      {amount(balance)}
                    </p>
                    <p className="mt-1 text-xs text-[#6E6D7A]">
                      Saldo awal: {amount(wallet.init_balance)}
                    </p>
                  </div>
                  <div className="mt-5 flex gap-2 pt-3 border-t border-[#E8E6E1]">
                    <button className="btn-compact flex-1" onClick={() => openTransferModal(wallet.id)}>
                      Transfer
                    </button>
                    <ActionMenu
                      items={[
                        { label: "Edit Dompet", onClick: () => onEdit(wallet) },
                        { label: "Hapus", destructive: true, onClick: () => onDelete(wallet.id) }
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Create / Edit Wallet Form Panel */}
        <FormCard className="self-start bg-[#F0EEE9] shadow-none">
          <FormCardHeader>
            <FormCardTitle>{draft.id ? "Edit Dompet" : "Tambah Dompet Baru"}</FormCardTitle>
          </FormCardHeader>
          <form noValidate onSubmit={handleWalletSubmit}>
            <FormCardContent>
              <ResponsiveFormGrid>
                {submitError ? (
                  <FormGridItem span={2}>
                    <p role="alert" className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]">
                      {submitError}
                    </p>
                  </FormGridItem>
                ) : null}
                <FormGridItem span={2}>
                  <FormField label="Nama Dompet / Rekening" required error={fieldErrors.name}>
                    <TextField id="wallet-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} onBlur={() => validateAndSetField("name")} />
                  </FormField>
                </FormGridItem>
                <FormField label="Kategori Dompet" required error={fieldErrors.category}>
                  <NativeSelectField id="wallet-category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} onBlur={() => validateAndSetField("category")}>
                    <option value="">Pilih kategori dompet</option>
                    {walletCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </NativeSelectField>
                </FormField>
                <FormField label="Mata Uang" required hint="Gunakan kode ISO 4217, misalnya IDR." error={fieldErrors.currency}>
                  <TextField id="wallet-currency" value={draft.currency} maxLength={3} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} onBlur={() => validateAndSetField("currency")} />
                </FormField>
                <FormField label="Penyedia (Bank / Provider)">
                  <TextField value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value })} />
                </FormField>
                <FormField label="Nomor Rekening / Akun">
                  <TextField value={draft.account_number} onChange={(event) => setDraft({ ...draft, account_number: event.target.value })} />
                </FormField>
                <FormGridItem span={2}>
                  <FormField label="Saldo Awal" required hint="Nilai disimpan sebagai Rupiah tanpa pecahan." error={fieldErrors.init_balance}>
                    <MoneyField id="wallet-init_balance" currency="Rp" value={draft.init_balance} onValueChange={(init_balance) => setDraft({ ...draft, init_balance })} onBlur={() => validateAndSetField("init_balance")} />
                  </FormField>
                </FormGridItem>
              </ResponsiveFormGrid>
            </FormCardContent>
            <FormCardFooter>
              <SubmitAction className="btn-primary w-full sm:w-auto" isSubmitting={submitBusy} label="Simpan Dompet" busyLabel="Menyimpan dompet..." />
            </FormCardFooter>
          </form>
        </FormCard>
      </div>

      {/* Modal Transfer Antar Dompet (DEC-04 & DEC-09) */}
      <AppDialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <AppDialogContent size="md">
          <AppDialogHeader>
            <p className="eyebrow text-[#5A5A5A]">DEC-04 Single Record Transfer</p>
            <AppDialogTitle>Transfer Antar Dompet</AppDialogTitle>
          </AppDialogHeader>
          <AppDialogBody>
            <form id="transfer-form" className="grid gap-4" onSubmit={handleTransferSubmit}>
              {transferError ? (
                <p role="alert" className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]">
                  {transferError}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Dompet Asal" required>
                  <NativeSelectField
                    value={sourceWalletId}
                    onChange={(e) => setSourceWalletId(e.target.value)}
                  >
                    <option value="">Pilih Dompet Asal</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </NativeSelectField>
                </FormField>
                <FormField label="Dompet Tujuan" required>
                  <NativeSelectField
                    value={destWalletId}
                    onChange={(e) => setDestWalletId(e.target.value)}
                  >
                    <option value="">Pilih Dompet Tujuan</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </NativeSelectField>
                </FormField>
              </div>

              <FormField label="Nominal Transfer (Rp)" required>
                <MoneyField
                  id="transfer-amount"
                  currency="Rp"
                  value={transferAmount}
                  onValueChange={setTransferAmount}
                  placeholder="Contoh: 100000"
                />
              </FormField>

              <FormField label="Biaya Admin Bank (Rp) — Auto Expense">
                <MoneyField
                  id="transfer-fee"
                  currency="Rp"
                  value={adminFee}
                  onValueChange={setAdminFee}
                  placeholder="Contoh: 6500"
                />
              </FormField>

              <FormField label="Waktu Transfer">
                <TextField
                  type="datetime-local"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </FormField>

              <FormField label="Catatan / Keterangan Transfer">
                <TextField
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Catatan opsional..."
                />
              </FormField>
            </form>
          </AppDialogBody>
          <AppDialogFooter>
            <button type="button" className="btn-secondary" onClick={() => setTransferModalOpen(false)}>
              Batal
            </button>
            <button type="submit" form="transfer-form" className="btn-primary">
              Review Transfer
            </button>
          </AppDialogFooter>
        </AppDialogContent>
      </AppDialog>

      <ReviewDialog
        open={reviewTransferOpen}
        onOpenChange={setReviewTransferOpen}
        title="Review Transfer Antar Dompet"
        description="Periksa kembali detail transfer sebelum dieksekusi. Transaksi akan langsung memperbarui saldo dompet."
        items={reviewTransferItems}
        onConfirm={executeTransfer}
        confirmText={transferBusy ? "Memproses..." : "Eksekusi Transfer Atomik"}
      />
    </InfoTooltipProvider>
  );
}
