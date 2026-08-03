"use client";

import { useState, type FormEvent } from "react";
import type { Category, Transaction, Wallet } from "@/lib/api";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { Fact, Panel, SelectField, TextInput, Textarea } from "@/components/ui/dashboard";
import { EmptyState } from "@/components/ui/feedback";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";

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
          <form className="mb-6 rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] p-4 shadow-sm" onSubmit={onExtract}>
            <div className="panel-head mb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="eyebrow text-[#5A5A5A]">Gemini Multimodal Capture</p>
                  <InfoTooltip content="Ketik atau tempel teks struk / WhatsApp payment. Gemini AI akan mengekstrak otomatis ke Kotak Masuk." />
                </div>
                <h3 className="section-title text-[#1A1A1A] text-lg font-bold">Ekstrak Teks Transaksi</h3>
              </div>
              <button className="btn-primary" disabled={busy || !aiText.trim()} type="submit">
                Ekstrak AI
              </button>
            </div>
            <Textarea label="Teks mentah struk / transfer" value={aiText} onChange={onAIText} />
            {aiNotice ? (
              <p className="mt-3 rounded-lg border border-[#E0DDD6] bg-[#FBF9F5] px-3 py-2 text-xs font-medium text-[#1A1A1A]">
                {aiNotice}
              </p>
            ) : null}
          </form>

          <div className="panel-head mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="eyebrow text-[#5A5A5A]">Staging Review (DEC-02)</p>
                <InfoTooltip content="Seluruh hasil tangkapan AI/Screenshot masuk ke Kotak Masuk untuk dikonfirmasi 1-click oleh pengguna." />
              </div>
              <h3 className="section-title text-[#1A1A1A] text-xl font-bold">
                {inbox.length} Menunggu Verifikasi
              </h3>
            </div>
            <span className="kbd">Navigasi: Klik / J/K</span>
          </div>

          <div className="grid gap-3">
            {inbox.length === 0 ? (
              <EmptyState title="Kotak Masuk Bersih" description="Transaksi baru dari Gemini AI atau Shortcut akan tampil di sini." />
            ) : null}
            {inbox.map((transaction) => (
              <button
                key={transaction.id}
                onClick={() => onSelect(transaction.id)}
                className={cx(
                  "rounded-xl p-4 text-left outline-none transition shadow-sm border",
                  selected?.id === transaction.id
                    ? "border-[#4F46E5] bg-[#FFFFFF] ring-2 ring-[#4F46E5]"
                    : "border-[#E0DDD6] bg-[#FFFFFF] hover:bg-[#FBF9F5]"
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
                  <span className={cx("text-sm font-bold tabular-nums", transaction.type === "income" ? "text-[#059669]" : "text-[#1A1A1A]")}>
                    {amount(transaction.amount)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#E8E5DF] px-2 py-0.5 text-xs font-medium text-[#1A1A1A] uppercase tracking-wider">
                    {transaction.type}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-semibold text-[#92400E] uppercase tracking-wider">
                    {transaction.status}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[#E8E5DF] px-2 py-0.5 text-xs font-medium text-[#5A5A5A]">
                    {transaction.input_source ?? "manual"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        {/* Right Column: Selected Transaction Detail & 1-Click Action Buttons */}
        <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
          {selected ? (
            <>
              <div className="panel-head border-b border-[#E0DDD6] pb-4 mb-4">
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

              <div className="mt-5 rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] p-4">
                <p className="eyebrow text-[#5A5A5A]">Catatan Mentah OCR / AI</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#1A1A1A] font-mono">
                  {selected.raw_input || selected.note || "Tidak ada catatan mentah"}
                </p>
              </div>

              {/* 1-Click Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-[#E0DDD6]">
                <button disabled={busy} className="btn-primary flex-1 py-2.5 text-base" onClick={() => onApprove(selected)}>
                  ✓ Setujui (Approve)
                </button>
                <button disabled={busy} className="btn-secondary flex-1 py-2.5 text-base" onClick={() => openEditModal(selected)}>
                  ✏️ Edit & Setujui (DEC-12)
                </button>
                <button disabled={busy} className="btn-danger py-2.5 px-4" onClick={() => onReject(selected)}>
                  ✕ Tolak
                </button>
              </div>
            </>
          ) : (
            <EmptyState title="Belum Ada Transaksi Dipilih" description="Pilih transaksi di Kotak Masuk untuk melihat detail dan melakukan verifikasi 1-click." />
          )}
        </Panel>
      </div>

      {/* Direct Edit & Setujui Modal (DEC-12) */}
      {editModalOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 border border-[#E0DDD6]">
            <div className="flex items-center justify-between border-b border-[#E0DDD6] pb-3">
              <div>
                <p className="eyebrow text-[#5A5A5A]">DEC-12 Direct OCR Correction</p>
                <h3 className="text-lg font-bold text-[#1A1A1A]">Edit & Setujui Transaksi</h3>
              </div>
              <button className="link-button text-[#5A5A5A]" onClick={() => setEditModalOpen(false)}>
                Tutup
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              <TextInput label="Merchant / Nama Transaksi" value={editMerchant} onChange={setEditMerchant} />
              <TextInput label="Nominal (Rp)" value={editAmount} onChange={setEditAmount} />
              <SelectField
                value={editWalletId}
                onValueChange={setEditWalletId}
                options={wallets.map((w) => w.id)}
                labels={Object.fromEntries(wallets.map((w) => [w.id, w.name]))}
                placeholder="Pilih Dompet"
              />
              <SelectField
                value={editCategoryId}
                onValueChange={setEditCategoryId}
                options={categories.map((c) => c.id)}
                labels={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
                placeholder="Pilih Kategori"
              />
              <Textarea label="Catatan Tambahan" value={editNote} onChange={setEditNote} />
              <label className="flex items-center gap-2.5 rounded-lg border border-[#E0DDD6] bg-[#FBF9F5] p-3 text-xs font-semibold text-[#1A1A1A]">
                <input
                  type="checkbox"
                  checked={saveAsRule}
                  onChange={(e) => setSaveAsRule(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E0DDD6] accent-[#4F46E5]"
                />
                Simpan merchant ini sebagai Pattern Rule untuk Auto-Approve berikutnya (Confidence = 1.0)
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-[#E0DDD6]">
              <button className="btn-secondary" onClick={() => setEditModalOpen(false)}>
                Batal
              </button>
              <button className="btn-primary" onClick={handleSaveAndApprove}>
                Simpan & Setujui Ke Ledger
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </InfoTooltipProvider>
  );
}
