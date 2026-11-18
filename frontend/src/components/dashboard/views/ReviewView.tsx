"use client";

import { useState } from "react";
import type { Category, Transaction, Wallet } from "@/lib/api";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { Fact, Panel } from "@/components/ui/dashboard";
import { EmptyState } from "@/components/ui/feedback";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";

import { FormField, TextareaField, TextField, NativeSelectField, MoneyField } from "@/components/ui/form";
import { ListCard, ListCardItem } from "@/components/ui/cards/list-card";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { SwipeRow } from "@/components/ui/swipe-row";
import {
  AppDialog,
  AppDialogBody,
  AppDialogContent,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
  useMediaQuery,
} from "@/components/ui/dialog";

import { AlertTriangle, ArrowRight, Check, Plus, Trash2, X } from "lucide-react";
import { LoadingState } from "@/components/ui/feedback";

type Props = {
  inbox: Transaction[];
  selected?: Transaction;
  wallets?: Wallet[];
  categories?: Category[];
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  busy: boolean;
  /** First fetch of the inbox is still in flight. */
  loading?: boolean;
  onSelect: (id: string) => void;
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
  loading = false,
  onSelect,
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
  const [editType, setEditType] = useState<"income" | "expense" | "transfer">("expense");
  const [editDestinationWalletId, setEditDestinationWalletId] = useState("");
  const [editIsReimbursement, setEditIsReimbursement] = useState(false);
  const [saveAsRule, setSaveAsRule] = useState(false);
  // Below xl the detail opens as a bottom sheet with the actions pinned in the thumb zone.
  const isWide = useMediaQuery("(min-width: 1280px)");
  const [sheetOpen, setSheetOpen] = useState(false);

  function openEditModal(t: Transaction) {
    if (onEdit) {
      onEdit(t);
      return;
    }
    setEditMerchant(t.merchant || "");
    setEditAmount(String(t.amount || ""));
    setEditWalletId(t.wallet_id || "");
    setEditDestinationWalletId(t.destination_wallet_id || "");
    setEditCategoryId(t.category_id || "");
    setEditNote(t.note || t.raw_input || "");
    setEditType((t.type === "income" || t.type === "transfer") ? t.type : "expense");
    setEditIsReimbursement(Boolean(t.is_reimbursement));
    setEditModalOpen(true);
  }

  async function handleSaveAndApprove() {
    if (!selected || !onSaveEdit) return;
    const parsedAmount = parseFloat(editAmount) || Number(selected.amount);
    await onSaveEdit(selected, {
      merchant: editMerchant,
      amount: parsedAmount,
      type: editType,
      wallet_id: editWalletId,
      destination_wallet_id: editType === "transfer" ? (editDestinationWalletId || null) : null,
      category_id: editType === "transfer" ? null : (editCategoryId || null),
      note: editNote,
      is_reimbursement: editType === "expense" && editIsReimbursement,
      reimbursement_status: editType === "expense" && editIsReimbursement
        ? selected.reimbursement_status && selected.reimbursement_status !== "none"
          ? selected.reimbursement_status
          : "receivable"
        : "none",
      status: "approved",
    });
    setEditModalOpen(false);
  }

  // Detail and actions are shared by the desktop side panel and the mobile bottom sheet.
  const renderDetail = (tx: Transaction) => (
    <>
      <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
        <div className="min-w-0 pr-2">
          <h2 className="text-lg sm:text-xl font-bold text-ink truncate">{tx.merchant || "Detail Transaksi Draft"}</h2>
          <p className="text-xs text-ink-soft">ID: {shortID(tx.id)} · Mode: {tx.input_mode || "ai"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tx.type === "transfer" && (
            <span className="inline-flex items-center rounded-full border border-info-line bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info">
              Transfer Antar-Dompet
            </span>
          )}
          {tx.is_reimbursement && (
            <span className="inline-flex items-center rounded-full border border-caution-line bg-caution-soft px-2.5 py-0.5 text-xs font-semibold text-caution">
              Piutang
            </span>
          )}
          <Badge variant={tx.status === "approved" ? "success" : "warning"}>{tx.status}</Badge>
        </div>
      </div>

      {tx.duplicate_of_id && (
        <div className="mb-6 p-4 rounded-xl border border-caution-line bg-caution-soft shadow-2xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-caution-soft text-caution shrink-0">
              <AlertTriangle className="size-5 text-caution" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-caution">
                  Kemungkinan Duplikat (Mesin Anti-Duplikasi Lapis 3)
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-caution-soft/80 text-caution border border-caution-line">
                  Soft Window Match
                </span>
              </div>
              <p className="text-xs text-caution/90 mt-1.5 leading-relaxed">
                Transaksi ini memiliki nominal dan waktu yang sangat mirip dengan transaksi lain dari sumber berbeda.
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onReject(tx)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-negative-solid hover:bg-negative-solid text-white text-xs font-bold transition shadow-2xs active:scale-98 disabled:opacity-50 min-h-11 md:min-h-[36px]"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> Hapus Duplikat
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (onSaveEdit) {
                      await onSaveEdit(tx, { status: "approved" });
                    } else {
                      await onApprove(tx);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-positive-solid hover:bg-positive-solid text-white text-xs font-bold transition shadow-2xs active:scale-98 disabled:opacity-50 min-h-11 md:min-h-[36px]"
                >
                  <Plus className="size-3.5" aria-hidden="true" /> Tetap Simpan (Beli 2x)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Fact label="Nominal Transaksi" value={amount(tx.amount)} />
        <Fact label="Tanggal" value={dateLabel(tx.transaction_at)} />
        <Fact 
          label={tx.type === "transfer" ? "Dompet Asal (Debit)" : "Dompet"} 
          value={tx.wallet_id ? walletById.get(tx.wallet_id)?.name || "Default" : "Belum ditentukan"} 
        />
        {tx.type === "transfer" ? (
          <Fact 
            label="Dompet Tujuan (Kredit)" 
            value={tx.destination_wallet_id ? walletById.get(tx.destination_wallet_id)?.name || "Tujuan" : "Belum ditentukan (Pilih di Edit)"} 
          />
        ) : (
          <Fact 
            label="Kategori" 
            value={tx.category_id ? categoryById.get(tx.category_id)?.name || "Lainnya" : "Belum dikategori"} 
          />
        )}
      </div>

      {tx.note && (
        <div className="mb-6 p-3 bg-paper border border-line rounded-lg">
          <p className="text-xs font-semibold text-ink-soft mb-1">Catatan / Teks Mentah</p>
          <p className="text-sm text-ink break-words">{tx.note}</p>
        </div>
      )}
    </>
  );

  const renderActions = (tx: Transaction, className?: string, after?: () => void) => (
    <div className={cx("flex flex-wrap items-center gap-3", className)}>
        <button disabled={busy} className="btn-primary flex-1 min-h-[44px] py-2.5 text-sm sm:text-base" onClick={() => {
          after?.();
          void onApprove(tx);
        }}>
          Setujui (Approve)
        </button>
        <button disabled={busy} className="btn-secondary flex-1 min-h-[44px] py-2.5 text-sm sm:text-base" onClick={() => {
          after?.();
          openEditModal(tx);
        }}>
          Edit &amp; Setujui
        </button>
        <button disabled={busy} className="btn-danger min-h-[44px] py-2.5 px-4 text-sm sm:text-base" onClick={() => {
          after?.();
          void onReject(tx);
        }}>
          Tolak
        </button>
    </div>
  );

  return (
    <InfoTooltipProvider>
      <div className="w-full min-w-0 max-w-full grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Left column: the queue */}
        <div className="space-y-4 sm:space-y-6 min-w-0">
          <ListCard 
            title={`${inbox.length} Menunggu Verifikasi`}
            description="Staging Review (DEC-02)"
            headerAction={
              <div className="flex items-center gap-1.5">
                <span className="kbd text-xs">Navigasi: Klik / J/K</span>
                <InfoTooltip content="Seluruh hasil tangkapan AI/Screenshot masuk ke Kotak Masuk untuk dikonfirmasi 1-click oleh pengguna." />
              </div>
            }
            className="bg-card border border-line rounded-xl shadow-xs"
          >
            {loading && inbox.length === 0 ? (
              <LoadingState variant="list" rows={4} label="Memuat kotak masuk" className="p-3 [&_.rounded-2xl]:border-0" />
            ) : inbox.length === 0 ? (
              <EmptyState
                illustration="inbox"
                title="Kotak masuk bersih"
                description="Semua transaksi sudah kamu periksa. Catatan baru dari foto struk, teks, atau notifikasi bank akan muncul di sini."
              />
            ) : (
              inbox.map((transaction) => (
                <SwipeRow
                  key={transaction.id}
                  disabled={busy}
                  right={{ label: "Setujui", icon: Check, tone: "mint", onCommit: () => void onApprove(transaction) }}
                  left={{ label: "Tolak", icon: X, tone: "negative", onCommit: () => void onReject(transaction) }}
                >
                <ListCardItem
                  onClick={() => {
                    onSelect(transaction.id);
                    if (!isWide) setSheetOpen(true);
                  }}
                  className={cx(
                    selected?.id === transaction.id
                      ? "bg-paper ring-2 ring-inset ring-ink z-10 relative"
                      : "bg-card"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink">{transaction.merchant || "Merchant tidak diketahui"}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs text-ink-soft">
                          {dateLabel(transaction.transaction_at)} · {transaction.type === "transfer" ? (
                            <>
                              {transaction.wallet_id ? walletById.get(transaction.wallet_id)?.name || "Sumber" : "Sumber"}
                              <ArrowRight className="mx-1 inline size-3 align-[-1px]" aria-label="ke" />
                              {transaction.destination_wallet_id ? walletById.get(transaction.destination_wallet_id)?.name || "Tujuan" : "Pilih Tujuan"}
                            </>
                          ) : (
                            transaction.wallet_id ? walletById.get(transaction.wallet_id)?.name : "Tanpa Dompet"
                          )}
                        </p>
                        {transaction.type === "transfer" && (
                          <span className="inline-flex rounded-full border border-info-line bg-info-soft px-1.5 py-0.5 text-xs font-bold text-info">
                            Transfer Antar-Dompet
                          </span>
                        )}
                        {transaction.is_reimbursement && (
                          <span className="inline-flex rounded-full border border-caution-line bg-caution-soft px-1.5 py-0.5 text-xs font-bold text-caution">
                            Piutang
                          </span>
                        )}
                        {transaction.duplicate_of_id && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-caution-line bg-caution-soft px-1.5 py-0.5 text-xs font-bold text-caution">
                            <AlertTriangle className="size-3" aria-hidden="true" /> Kemungkinan Duplikat
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-ink">{amount(transaction.amount)}</p>
                      <Badge variant={transaction.status === "needs_review" ? "warning" : "default"}>{transaction.status}</Badge>
                    </div>
                  </div>

                  {transaction.duplicate_of_id && (
                    <div
                      className="mt-2.5 p-2 rounded-lg bg-caution-soft/90 border border-caution-line text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs text-caution leading-tight">
                        <strong>Kemungkinan duplikat:</strong> nominal &amp; waktu sangat mirip transaksi lain.
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onReject(transaction)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 md:min-h-0 md:px-2 md:py-1 rounded bg-negative-solid hover:bg-negative-solid text-white text-xs font-bold transition active:scale-98"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" /> Hapus Duplikat
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            if (onSaveEdit) {
                              await onSaveEdit(transaction, { status: "approved" });
                            } else {
                              await onApprove(transaction);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 md:min-h-0 md:px-2 md:py-1 rounded bg-positive-solid hover:bg-positive-solid text-white text-xs font-bold transition active:scale-98"
                        >
                          <Plus className="size-3.5" aria-hidden="true" /> Tetap Simpan (Beli 2x)
                        </button>
                      </div>
                    </div>
                  )}
                </ListCardItem>
                </SwipeRow>
              ))
            )}
          </ListCard>
        </div>

        {/* Right Column: Detailed Review & 1-Click Action */}
        <Panel className="hidden min-w-0 rounded-xl border border-line bg-card p-4 shadow-xs sm:p-6 xl:block">
          {selected ? (
            <>
              {renderDetail(selected)}
              {renderActions(selected, "mt-6 border-t border-line pt-4")}
            </>
          ) : (
            <div className="p-4 sm:p-8 flex flex-col items-center justify-center text-center">
              <EmptyState
                compact
                illustration="ledger"
                title="Belum ada yang dipilih"
                description="Pilih transaksi di daftar untuk melihat detailnya, lalu setujui atau tolak."
              />
            </div>
          )}
        </Panel>
      </div>

      <AppDialog open={sheetOpen && !isWide && Boolean(selected)} onOpenChange={setSheetOpen}>
        <AppDialogContent size="md" snap="half">
          {selected ? (
            <>
              <AppDialogHeader className="sr-only">
                <AppDialogTitle>{selected.merchant || "Detail transaksi"}</AppDialogTitle>
              </AppDialogHeader>
              <AppDialogBody className="pt-2">{renderDetail(selected)}</AppDialogBody>
              <AppDialogFooter>{renderActions(selected, "w-full", () => setSheetOpen(false))}</AppDialogFooter>
            </>
          ) : null}
        </AppDialogContent>
      </AppDialog>

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

          <FormField label="Jenis transaksi" htmlFor="editType">
            <NativeSelectField
              id="editType"
              value={editType}
              onChange={(e) => {
                const type = e.target.value as "income" | "expense" | "transfer";
                setEditType(type);
                if (type !== "expense") setEditIsReimbursement(false);
                const currentCat = categoryById.get(editCategoryId);
                if (currentCat && currentCat.type !== type) {
                  setEditCategoryId("");
                }
              }}
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer Antar-Dompet / Top-Up</option>
            </NativeSelectField>
          </FormField>

          <FormField label={editType === "transfer" ? "Dompet Asal (Debit / Sumber Dana)" : "Dompet"} htmlFor="editWallet">
            <NativeSelectField id="editWallet" value={editWalletId} onChange={(e) => setEditWalletId(e.target.value)}>
              <option value="" disabled>Pilih Dompet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </NativeSelectField>
          </FormField>

          {editType === "transfer" && (
            <FormField label="Dompet Tujuan (Kredit / Penerima Dana)" htmlFor="editDestWallet">
              <NativeSelectField
                id="editDestWallet"
                value={editDestinationWalletId}
                onChange={(e) => setEditDestinationWalletId(e.target.value)}
              >
                <option value="">Pilih Dompet Tujuan</option>
                {wallets
                  .filter((w) => w.id !== editWalletId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
              </NativeSelectField>
            </FormField>
          )}

          {editType !== "transfer" ? (
            <FormField label="Kategori" htmlFor="editCategory">
              <NativeSelectField id="editCategory" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                <option value="">Tanpa Kategori (Opsional)</option>
                {categories
                  .filter((c) => c.type === editType)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </NativeSelectField>
            </FormField>
          ) : (
            <p className="text-xs text-ink-soft bg-paper p-2.5 rounded-lg border border-line">
              ℹ️ Transfer antar-dompet mutasi saldo atomik di kedua akun tanpa memotong anggaran belanja pribadi.
            </p>
          )}

          <FormField label="Catatan Tambahan" htmlFor="editNote">
            <TextareaField id="editNote" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </FormField>
          
          {editType === "expense" && <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-line bg-paper p-3 text-xs font-semibold text-ink transition hover:bg-paper">
            <input
              type="checkbox"
              checked={editIsReimbursement}
              onChange={(e) => setEditIsReimbursement(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line-strong text-ink focus:ring-black"
            />
            <div>
              <span className="block text-sm font-semibold text-ink">
                Tandai sebagai Reimbursement (Piutang)
              </span>
              <span className="block text-xs font-normal text-ink-soft">
                Pengeluaran ini tidak akan memotong anggaran belanja pribadi dan akan dicatat sebagai klaim piutang.
              </span>
            </div>
          </label>}

          <label className="flex items-center gap-2.5 rounded-lg border border-line bg-paper p-3 text-xs font-semibold text-ink">
            <input
              type="checkbox"
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-ink"
            />
            Simpan merchant ini sebagai Pattern Rule untuk Auto-Approve berikutnya (Confidence = 1.0)
          </label>
        </div>
      </FormDialog>

    </InfoTooltipProvider>
  );
}
