"use client";

import { useState, type FormEvent } from "react";
import type { Wallet, WalletBalance } from "@/lib/api";
import type { DraftWallet } from "../model";
import { walletCategories } from "../model";
import { amount, cx } from "../formatters";
import { CurrencyInput, Panel, SelectField, TextInput } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { ActionMenu } from "@/components/ui/action-menu";

type Props = {
  wallets: Wallet[];
  balances: Record<string, WalletBalance>;
  draft: DraftWallet;
  setDraft: (draft: DraftWallet) => void;
  onSubmit: (event: FormEvent) => void;
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

export function WalletsView({
  wallets,
  balances,
  draft,
  setDraft,
  onSubmit,
  onEdit,
  onDelete,
  onTransfer,
}: Props) {
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [sourceWalletId, setSourceWalletId] = useState("");
  const [destWalletId, setDestWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [adminFee, setAdminFee] = useState("0");
  const [transferDate, setTransferDate] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");

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
    const parsedFee = parseFloat(adminFee) || 0;

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

    setTransferBusy(true);
    try {
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
      setTransferModalOpen(false);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : "Gagal melakukan transfer.");
    } finally {
      setTransferBusy(false);
    }
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
        <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-[#E0DDD6] pb-3 mb-4">
            <h3 className="section-title text-[#1A1A1A] text-lg font-bold">
              {draft.id ? "Edit Dompet" : "Tambah Dompet Baru"}
            </h3>
          </div>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <TextInput label="Nama Dompet / Rekening" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
            <SelectField
              value={draft.category}
              onValueChange={(category) => setDraft({ ...draft, category })}
              options={walletCategories}
              placeholder="Pilih Kategori Dompet"
            />
            <TextInput label="Penyedia (Bank / Provider)" value={draft.provider} onChange={(provider) => setDraft({ ...draft, provider })} />
            <TextInput
              label="Nomor Rekening / Akun"
              value={draft.account_number}
              onChange={(account_number) => setDraft({ ...draft, account_number })}
            />
            <TextInput label="Mata Uang" value={draft.currency} onChange={(currency) => setDraft({ ...draft, currency })} />
            <CurrencyInput
              label="Saldo Awal (Rp)"
              value={draft.init_balance}
              onChange={(init_balance) => setDraft({ ...draft, init_balance })}
            />
            <button className="btn-primary w-full py-2.5 mt-2" type="submit">
              Simpan Dompet
            </button>
          </form>
        </Panel>
      </div>

      {/* Modal Transfer Antar Dompet (DEC-04 & DEC-09) */}
      {transferModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 border border-[#E0DDD6]">
            <div className="flex items-center justify-between border-b border-[#E0DDD6] pb-3">
              <div>
                <p className="eyebrow text-[#5A5A5A]">DEC-04 Single Record Transfer</p>
                <h3 className="text-lg font-bold text-[#1A1A1A]">Transfer Antar Dompet</h3>
              </div>
              <button className="link-button text-[#5A5A5A]" onClick={() => setTransferModalOpen(false)}>
                Tutup
              </button>
            </div>

            <form className="mt-4 grid gap-4" onSubmit={handleTransferSubmit}>
              {transferError ? (
                <p className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]">
                  {transferError}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  value={sourceWalletId}
                  onValueChange={setSourceWalletId}
                  options={wallets.map((w) => w.id)}
                  labels={Object.fromEntries(wallets.map((w) => [w.id, w.name]))}
                  placeholder="Dompet Asal"
                />
                <SelectField
                  value={destWalletId}
                  onValueChange={setDestWalletId}
                  options={wallets.map((w) => w.id)}
                  labels={Object.fromEntries(wallets.map((w) => [w.id, w.name]))}
                  placeholder="Dompet Tujuan"
                />
              </div>

              <TextInput
                label="Nominal Transfer (Rp)"
                value={transferAmount}
                onChange={setTransferAmount}
                placeholder="Contoh: 100000"
                required
              />

              <TextInput
                label="Biaya Admin Bank (Rp) — Auto Expense"
                value={adminFee}
                onChange={setAdminFee}
                placeholder="Contoh: 6500"
              />

              <TextInput
                label="Waktu Transfer"
                type="datetime-local"
                value={transferDate}
                onChange={setTransferDate}
              />

              <TextInput
                label="Catatan / Keterangan Transfer"
                value={transferNote}
                onChange={setTransferNote}
                placeholder="Catatan opsional..."
              />

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-[#E0DDD6]">
                <button type="button" className="btn-secondary" onClick={() => setTransferModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" disabled={transferBusy} className="btn-primary">
                  {transferBusy ? "Memproses..." : "Eksekusi Transfer Atomik"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </InfoTooltipProvider>
  );
}
