"use client";

import { useState, type FormEvent } from "react";
import { Plus, ArrowLeftRight, Pencil, Trash2, ChevronRight, Wallet as WalletIcon } from "lucide-react";
import type { Wallet, WalletBalance } from "@/lib/api";
import { amount } from "../formatters";
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
  FormField,
  MoneyField,
  SelectField as NativeSelectField,
  TextField,
} from "@/components/ui/form";
import { ProviderAvatar } from "@/components/ui/provider-avatar";
import { LicenseDialog } from "@/components/ui/license-dialog";

type Props = {
  wallets: Wallet[];
  balances: Record<string, WalletBalance>;
  onOpenNewWallet: () => void;
  onEdit: (wallet: Wallet) => void;
  onDelete: (id: string) => void;
  onTransfer?: (payload: {
    wallet_id: string;
    destination_wallet_id: string;
    amount: number;
    admin_fee: number;
    transaction_at?: string;
    note?: string;
  }) => Promise<void>;
};

const categoryLabels: Record<string, string> = {
  bank: "Bank",
  wallet: "E-Wallet",
  cash: "Tunai",
  credit_card: "Kartu Kredit",
  investment: "Investasi",
  other: "Lainnya",
};

function formatCategory(category: string) {
  return categoryLabels[category] || category;
}

export function WalletsView({
  wallets,
  balances,
  onOpenNewWallet,
  onEdit,
  onDelete,
  onTransfer,
}: Props) {
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
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

  const totalBalance = wallets.reduce(
    (acc, w) =>
      acc +
      parseFloat(String(balances[w.id]?.curr_balance ?? w.init_balance ?? 0)),
    0
  );

  function openTransferModal(defaultSourceId?: string) {
    const initialSourceId = defaultSourceId || wallets[0]?.id || "";
    setSourceWalletId(initialSourceId);
    const initialDest =
      wallets.find((w) => w.id !== initialSourceId)?.id || wallets[1]?.id || "";
    setDestWalletId(initialDest);
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

  const sourceBalance = parseFloat(
    String(sourceWallet ? balances[sourceWallet.id]?.curr_balance ?? sourceWallet.init_balance : 0)
  );
  const destBalance = parseFloat(
    String(destWallet ? balances[destWallet.id]?.curr_balance ?? destWallet.init_balance : 0)
  );

  const reviewTransferItems = [
    {
      id: "source",
      label: (
        <div className="flex items-center gap-2">
          {sourceWallet && (
            <ProviderAvatar
              slug={sourceWallet.provider_slug}
              name={sourceWallet.provider || sourceWallet.name}
              size={20}
            />
          )}
          <span>Asal: {sourceWallet?.name || "-"}</span>
        </div>
      ),
      before: sourceBalance,
      after: sourceBalance - parsedTransferAmount - parsedAdminFee,
    },
    {
      id: "dest",
      label: (
        <div className="flex items-center gap-2">
          {destWallet && (
            <ProviderAvatar
              slug={destWallet.provider_slug}
              name={destWallet.provider || destWallet.name}
              size={20}
            />
          )}
          <span>Tujuan: {destWallet?.name || "-"}</span>
        </div>
      ),
      before: destBalance,
      after: destBalance + parsedTransferAmount,
    },
  ];

  if (parsedAdminFee > 0) {
    reviewTransferItems.push({
      id: "fee",
      label: <span>Biaya Admin</span>,
      before: 0,
      after: -parsedAdminFee,
    });
  }

  return (
    <InfoTooltipProvider>
      <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-full min-w-0">
        {/* Banner Total Saldo Seluruh Dompet */}
        <div className="w-full max-w-full min-w-0 rounded-2xl border border-[#E8E6E1] bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#756f64] uppercase tracking-wider">
                  Total Saldo Seluruh Dompet
                </span>
                <InfoTooltip content="Akumulasi saldo kekayaan di seluruh rekening dan e-wallet aktif berdasarkan saldo awal dan transaksi disetujui (DEC-04 & DEC-09)." />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] tabular-nums tracking-tight">
                  {amount(totalBalance)}
                </h2>
                <span className="inline-flex items-center rounded-full bg-[#F7F6F2] border border-[#E8E6E1] px-2.5 py-0.5 text-xs font-medium text-[#756f64]">
                  {wallets.length} Dompet Aktif
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenNewWallet}
                className="btn-primary flex items-center justify-center gap-1.5 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Dompet</span>
              </button>
              <button
                type="button"
                onClick={() => openTransferModal()}
                className="btn-secondary flex items-center justify-center gap-1.5 text-sm"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transfer Antar Dompet</span>
              </button>
            </div>
          </div>
        </div>

        {/* Kartu Dompet Kompak Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full min-w-0">
          {wallets.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-[#E8E6E1] bg-white p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[280px] shadow-xs">
              <div className="w-16 h-16 bg-[#F7F6F2] rounded-full flex items-center justify-center mb-4 border border-[#E8E6E1]">
                <WalletIcon className="w-8 h-8 text-[#756f64]" />
              </div>
              <h4 className="text-lg font-bold text-[#1A1A1A] mb-2">Belum Ada Dompet</h4>
              <p className="text-sm text-[#756f64] max-w-md mx-auto mb-6">
                Kelola dan pantau arus keuangan Anda dalam satu tempat. Tambahkan rekening bank, e-wallet, atau kartu Anda sebagai dompet pertama.
              </p>
              <button
                type="button"
                className="btn-primary flex items-center gap-2"
                onClick={onOpenNewWallet}
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Dompet Pertama</span>
              </button>
            </div>
          ) : (
            wallets.map((wallet) => {
              const balance = balances[wallet.id]?.curr_balance ?? wallet.init_balance;
              return (
                <div
                  key={wallet.id}
                  onClick={() => setSelectedWallet(wallet)}
                  className="group relative rounded-xl border border-[#E8E6E1] bg-white p-4 sm:p-5 shadow-xs hover:border-[#1A1A1A]/30 hover:shadow-sm transition-all flex flex-col justify-between cursor-pointer md:cursor-default w-full max-w-full min-w-0 overflow-hidden"
                >
                  <div>
                    {/* Header: Avatar, Name, Provider, Category Badge */}
                    <div className="flex items-start justify-between gap-2.5 min-w-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ProviderAvatar
                          slug={wallet.provider_slug}
                          name={wallet.provider || wallet.name}
                          size={40}
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-bold text-[#1A1A1A] leading-tight truncate">
                            {wallet.name}
                          </h4>
                          <p className="text-xs text-[#756f64] font-medium truncate mt-0.5">
                            {wallet.provider || "Rekening Utama"}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-[#F7F6F2] border border-[#E8E6E1] px-2 py-0.5 text-[10px] font-semibold text-[#1A1A1A] uppercase tracking-wider shrink-0">
                        {formatCategory(wallet.category)}
                      </span>
                    </div>

                    {/* Balance */}
                    <div className="mt-4">
                      <p className="text-xl sm:text-2xl font-extrabold text-[#1A1A1A] tabular-nums tracking-tight truncate">
                        {amount(balance)}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-xs text-[#756f64] gap-2">
                        <span className="truncate">Saldo awal: {amount(wallet.init_balance)}</span>
                        {wallet.account_number && (
                          <span className="font-mono text-[11px] text-[#756f64] shrink-0 bg-[#F7F6F2] px-1.5 py-0.5 rounded border border-[#E8E6E1]/70">
                            {wallet.account_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop Inline Actions */}
                  <div
                    className="mt-4 pt-3 border-t border-[#E8E6E1] hidden md:flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn-compact flex-1 flex items-center justify-center gap-1.5"
                      onClick={() => openTransferModal(wallet.id)}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Transfer</span>
                    </button>
                    <ActionMenu
                      items={[
                        {
                          label: "Edit Dompet",
                          onClick: () => onEdit(wallet),
                        },
                        {
                          label: "Hapus",
                          destructive: true,
                          onClick: () => onDelete(wallet.id),
                        },
                      ]}
                    />
                  </div>

                  {/* Mobile tap footer indicator */}
                  <div className="mt-3 pt-2.5 border-t border-[#E8E6E1]/60 flex md:hidden items-center justify-between text-[11px] font-medium text-[#756f64]">
                    <span>Ketuk untuk rincian dompet</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#756f64]" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Slide-Up Bottom Sheet Detail Dompet (Mobile) */}
        <AppDialog
          open={selectedWallet !== null}
          onOpenChange={(open) => !open && setSelectedWallet(null)}
        >
          {selectedWallet && (
            <AppDialogContent
              size="sm"
              showCloseButton={true}
              showDragHandle={true}
              className="w-full max-w-full min-w-0"
            >
              <AppDialogHeader className="pb-3 border-b border-[#E8E6E1]/70">
                <div className="flex items-start justify-between gap-3 min-w-0 pr-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <ProviderAvatar
                      slug={selectedWallet.provider_slug}
                      name={selectedWallet.provider || selectedWallet.name}
                      size={42}
                    />
                    <div className="min-w-0">
                      <AppDialogTitle className="text-base sm:text-lg font-bold text-[#1A1A1A] leading-snug truncate">
                        {selectedWallet.name}
                      </AppDialogTitle>
                      <p className="text-xs text-[#756f64] font-medium truncate mt-0.5">
                        {selectedWallet.provider || "Rekening Utama"}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-[#F7F6F2] border border-[#E8E6E1] px-2.5 py-0.5 text-[11px] font-semibold text-[#1A1A1A] uppercase tracking-wider shrink-0">
                    {formatCategory(selectedWallet.category)}
                  </span>
                </div>
              </AppDialogHeader>

              <AppDialogBody className="space-y-4 py-4">
                {/* Main Balance Display */}
                <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 text-center">
                  <span className="text-xs font-semibold text-[#756f64] uppercase tracking-wider">
                    Saldo Terkini
                  </span>
                  <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] tabular-nums tracking-tight">
                    {amount(
                      balances[selectedWallet.id]?.curr_balance ?? selectedWallet.init_balance
                    )}
                  </p>
                </div>

                {/* Detailed Info Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-3">
                    <p className="text-[11px] font-medium text-[#756f64]">Saldo Awal</p>
                    <p className="text-sm font-bold text-[#1A1A1A] tabular-nums mt-0.5">
                      {amount(selectedWallet.init_balance)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-3">
                    <p className="text-[11px] font-medium text-[#756f64]">Mata Uang</p>
                    <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">
                      {selectedWallet.currency || "IDR"}
                    </p>
                  </div>

                  <div className="col-span-2 rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-3">
                    <p className="text-[11px] font-medium text-[#756f64]">Nomor Rekening / Akun</p>
                    <p className="text-sm font-mono font-medium text-[#1A1A1A] mt-0.5">
                      {selectedWallet.account_number || "Tidak ada nomor rekening"}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold"
                    onClick={() => {
                      const id = selectedWallet.id;
                      setSelectedWallet(null);
                      openTransferModal(id);
                    }}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Transfer dari Dompet Ini</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="btn-secondary w-full flex items-center justify-center gap-2 py-2 text-sm font-medium"
                      onClick={() => {
                        const wallet = selectedWallet;
                        setSelectedWallet(null);
                        onEdit(wallet);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      <span>Edit Dompet</span>
                    </button>

                    <button
                      type="button"
                      className="btn-danger w-full flex items-center justify-center gap-2 py-2 text-sm font-medium"
                      onClick={() => {
                        const id = selectedWallet.id;
                        setSelectedWallet(null);
                        onDelete(id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Hapus Dompet</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="w-full text-center py-2 text-xs font-semibold text-[#756f64] hover:text-[#1A1A1A] transition-colors"
                    onClick={() => setSelectedWallet(null)}
                  >
                    Tutup
                  </button>
                </div>
              </AppDialogBody>
            </AppDialogContent>
          )}
        </AppDialog>

        {/* Modal Transfer Antar Dompet (DEC-04 & DEC-09) */}
        <AppDialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
          <AppDialogContent size="md">
            <AppDialogHeader>
              <p className="eyebrow text-[#756f64]">DEC-04 Single Record Transfer</p>
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
                    <div className="flex gap-2 items-center">
                      {sourceWallet && (
                        <div className="shrink-0">
                          <ProviderAvatar slug={sourceWallet.provider_slug} name={sourceWallet.provider || sourceWallet.name} size={36} />
                        </div>
                      )}
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
                    </div>
                  </FormField>
                  <FormField label="Dompet Tujuan" required>
                    <div className="flex gap-2 items-center">
                      {destWallet && (
                        <div className="shrink-0">
                          <ProviderAvatar slug={destWallet.provider_slug} name={destWallet.provider || destWallet.name} size={36} />
                        </div>
                      )}
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
                    </div>
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

        <div className="mt-4 text-center text-xs text-[#756f64]">
          <LicenseDialog>
            <button type="button" className="hover:underline hover:text-[#1A1A1A]">
              Logos powered by idn-finlogos (CC-BY-NC-4.0)
            </button>
          </LicenseDialog>
        </div>
      </div>
    </InfoTooltipProvider>
  );
}

