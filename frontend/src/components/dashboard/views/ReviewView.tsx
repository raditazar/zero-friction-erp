"use client";

import { useState, type FormEvent } from "react";
import type { Category, Transaction, Wallet } from "@/lib/api";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { Fact, Panel } from "@/components/ui/dashboard";
import { EmptyState } from "@/components/ui/feedback";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";

import {
  FormCard,
  FormCardHeader,
  FormCardTitle,
  FormCardDescription,
  FormCardContent,
  FormField,
  TextareaField,
  TextField,
  NativeSelectField,
  MoneyField,
  SubmitAction,
} from "@/components/ui/form";
import { ListCard, ListCardItem } from "@/components/ui/cards/list-card";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";

type Props = {
  inbox: Transaction[];
  selected?: Transaction;
  wallets?: Wallet[];
  categories?: Category[];
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  busy: boolean;
  aiText: string;
  aiNotice: string;
  onSelect: (id: string) => void;
  onAIText: (value: string) => void;
  onExtract: (event: FormEvent) => void;
  onApprove: (transaction: Transaction) => void | Promise<void>;
  onReject: (transaction: Transaction) => void | Promise<void>;
  onSaveEdit?: (transaction: Transaction, draft: Partial<Transaction>) => void | Promise<void>;
  onEdit?: (transaction: Transaction) => void;
};

export function ReviewView({
  inbox,
  selected,
  wallets = [],
  categories = [],
  walletById,
  categoryById,
  busy,
  aiText,
  aiNotice,
  onSelect,
  onAIText,
  onExtract,
  onApprove,
  onReject,
  onSaveEdit,
  onEdit,
}: Props) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editWalletId, setEditWalletId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saveAsRule, setSaveAsRule] = useState(false);

  const [rejectTx, setRejectTx] = useState<Transaction | null>(null);

  function openEditModal(t: Transaction) {
    if (onEdit) {
      onEdit(t);
      return;
    }
    setEditMerchant(t.merchant || "");
    setEditAmount(String(t.amount || ""));
    setEditWalletId(t.wallet_id || "");
    setEditCategoryId(t.category_id || "");
    setEditNote(t.note || t.raw_input || "");
    setEditModalOpen(true);
  }

  async function handleSaveAndApprove() {
    if (!selected || !onSaveEdit) return;
    const parsedAmount = parseFloat(editAmount) || Number(selected.amount);
    await onSaveEdit(selected, {
      merchant: editMerchant,
      amount: parsedAmount,
      wallet_id: editWalletId,
      category_id: editCategoryId || null,
      note: editNote,
      status: "approved",
    });
    setEditModalOpen(false);
  }

  return (
    <InfoTooltipProvider>
      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.4fr)]">
        {/* Left Column: AI Text Capture & Staging List */}
        <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
          <FormCard className="mb-6 border-0 shadow-sm">
            <form onSubmit={onExtract}>
              <FormCardHeader>
                <div>
                  <FormCardDescription className="flex items-center gap-1.5 font-medium">
                    <span className="eyebrow text-[#5A5A5A] leading-none">Gemini Multimodal Capture</span>
                    <InfoTooltip content="Ketik atau tempel teks struk / WhatsApp payment. Gemini AI akan mengekstrak otomatis ke Kotak Masuk." />
                  </FormCardDescription>
                  <FormCardTitle className="text-lg font-bold text-[#1A1A1A] mt-1">Ekstrak Teks Transaksi</FormCardTitle>
                </div>
                <SubmitAction label="Ekstrak AI" isSubmitting={busy} disabled={!aiText.trim()} />
              </FormCardHeader>
              <FormCardContent>
                <FormField label="Teks mentah struk / transfer" htmlFor="aiText">
                  <TextareaField
                    id="aiText"
                    value={aiText}
                    onChange={(e) => onAIText(e.target.value)}
                  />
                </FormField>
                {aiNotice ? (
                  <p className="mt-3 rounded-lg border border-0 bg-[#F9F8F5] px-3 py-2 text-xs font-medium text-[#1A1A1A]">
                    {aiNotice}
                  </p>
                ) : null}
              </FormCardContent>
            </form>
          </FormCard>

          <ListCard 
            title={`${inbox.length} Menunggu Verifikasi`}
            description="Staging Review (DEC-02)"
            headerAction={
              <div className="flex items-center gap-1.5">
                <span className="kbd text-xs">Navigasi: Klik / J/K</span>
                <InfoTooltip content="Seluruh hasil tangkapan AI/Screenshot masuk ke Kotak Masuk untuk dikonfirmasi 1-click oleh pengguna." />
              </div>
            }
            className="border-0 shadow-sm"
          >
            {inbox.length === 0 ? (
              <div className="p-8">
                <EmptyState title="Kotak Masuk Bersih" description="Transaksi baru dari Gemini AI atau Shortcut akan tampil di sini." />
              </div>
            ) : (
              inbox.map((transaction) => (
                <ListCardItem
                  key={transaction.id}
                  onClick={() => onSelect(transaction.id)}
                  className={cx(
                    selected?.id === transaction.id
                      ? "bg-[#F9F8F5] ring-2 ring-inset ring-[#4F46E5] z-10 relative"
                      : "bg-[#FFFFFF]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                        {transaction.merchant || "Merchant tidak diketahui"}
                      </p>
                      <p className="mt-1 text-xs text-[#5A5A5A]">
                        {walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id)} ·{" "}
                        {categoryById.get(transaction.category_id ?? "")?.name ?? "Belum ada kategori"}
                      </p>
                    </div>
                    <span className={cx("text-sm font-bold tabular-nums font-mono", transaction.type === "income" ? "text-[#059669]" : "text-[#1A1A1A]")}>
                      {amount(transaction.amount)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="neutral">{transaction.type}</Badge>
                    <Badge variant="warning">{transaction.status}</Badge>
                    <Badge variant="neutral">{transaction.input_source ?? "manual"}</Badge>
                  </div>
                </ListCardItem>
              ))
            )}
          </ListCard>
        </Panel>

        {/* Right Column: Selected Transaction Detail & 1-Click Action Buttons */}
        <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
          {selected ? (
            <>
              <div className="panel-head border-b border-0 pb-4 mb-4">
                <div>
                  <p className="eyebrow text-[#5A5A5A]">Detail Draf AI</p>
                  <h3 className="section-title text-[#1A1A1A] text-2xl font-bold">
                    {selected.merchant || "Merchant tidak diketahui"}
                  </h3>
                </div>
                <span className={cx("text-2xl font-bold tabular-nums", selected.type === "income" ? "text-[#059669]" : "text-[#1A1A1A]")}>
                  {amount(selected.amount)}
                </span>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label="Dompet" value={walletById.get(selected.wallet_id)?.name ?? shortID(selected.wallet_id)} />
                <Fact label="Kategori" value={categoryById.get(selected.category_id ?? "")?.name ?? "Butuh Kategori"} />
                <Fact label="Tanggal" value={dateLabel(selected.transaction_at)} />
                <Fact label="Skor AI Confidence" value={selected.ai_confidence ? `${(Number(selected.ai_confidence) * 100).toFixed(0)}%` : "n/a"} />
                <Fact label="Sumber Input" value={`${selected.input_source ?? "manual"} / ${selected.input_mode ?? "text"}`} />
                <Fact label="Klaim Piutang" value={selected.is_reimbursement ? selected.reimbursement_status : "Tidak"} />
              </dl>

              <div className="mt-5 rounded-xl border border-0 bg-[#FFFFFF] p-4">
                <p className="eyebrow text-[#5A5A5A]">Catatan Mentah OCR / AI</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#1A1A1A] font-mono">
                  {selected.raw_input || selected.note || "Tidak ada catatan mentah"}
                </p>
              </div>

              {/* 1-Click Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-0">
                <button disabled={busy} className="btn-primary flex-1 py-2.5 text-base" onClick={() => onApprove(selected)}>
                  ✓ Setujui (Approve)
                </button>
                <button disabled={busy} className="btn-secondary flex-1 py-2.5 text-base" onClick={() => openEditModal(selected)}>
                  ✏️ Edit & Setujui (DEC-12)
                </button>
                <button disabled={busy} className="btn-danger py-2.5 px-4" onClick={() => setRejectTx(selected)}>
                  ✕ Tolak
                </button>
              </div>
            </>
          ) : (
            <EmptyState title="Belum Ada Transaksi Dipilih" description="Pilih transaksi di Kotak Masuk untuk melihat detail dan melakukan verifikasi 1-click." />
          )}
        </Panel>
      </div>

      <FormDialog
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Edit & Setujui Transaksi"
        description="DEC-12 Direct OCR Correction"
        submitLabel="Simpan & Setujui Ke Ledger"
        onSubmit={async (e) => {
          e.preventDefault();
          await handleSaveAndApprove();
        }}
        isSubmitting={busy}
      >
        <div className="grid gap-4 py-4">
          <FormField label="Merchant / Nama Transaksi" htmlFor="editMerchant">
            <TextField id="editMerchant" value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)} />
          </FormField>
          
          <FormField label="Nominal (Rp)" htmlFor="editAmount">
            <MoneyField 
              id="editAmount"
              value={editAmount}
              onValueChange={setEditAmount}
            />
          </FormField>

          <FormField label="Dompet" htmlFor="editWallet">
            <NativeSelectField id="editWallet" value={editWalletId} onChange={(e) => setEditWalletId(e.target.value)}>
              <option value="" disabled>Pilih Dompet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </NativeSelectField>
          </FormField>

          <FormField label="Kategori" htmlFor="editCategory">
            <NativeSelectField id="editCategory" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
              <option value="" disabled>Pilih Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelectField>
          </FormField>

          <FormField label="Catatan Tambahan" htmlFor="editNote">
            <TextareaField id="editNote" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </FormField>
          
          <label className="flex items-center gap-2.5 rounded-lg border border-0 bg-[#F9F8F5] p-3 text-xs font-semibold text-[#1A1A1A]">
            <input
              type="checkbox"
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="h-4 w-4 rounded border-0 accent-[#4F46E5]"
            />
            Simpan merchant ini sebagai Pattern Rule untuk Auto-Approve berikutnya (Confidence = 1.0)
          </label>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!rejectTx}
        onOpenChange={(open) => { if (!open) setRejectTx(null); }}
        title="Tolak Transaksi Kotak Masuk?"
        description={`Apakah Anda yakin ingin menolak transaksi dari ${rejectTx?.merchant || 'merchant ini'} sejumlah ${amount(rejectTx?.amount || 0)}?\nTransaksi ini akan dihapus dari antrean.`}
        variant="warning"
        isConfirming={busy}
        onConfirm={async () => {
          if (rejectTx) {
            await onReject(rejectTx);
            setRejectTx(null);
          }
        }}
      />
    </InfoTooltipProvider>
  );
}
