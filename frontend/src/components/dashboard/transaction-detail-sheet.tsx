"use client";

import { Check, Clock, Edit3, Trash2, X } from "lucide-react";
import type { Transaction, TransactionStatus } from "@/lib/api";
import {
  AppDialog,
  AppDialogBody,
  AppDialogContent,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
} from "@/components/ui/dialog";
import { amount, dateLabel } from "./formatters";

const STATUS_LABEL: Record<string, string> = {
  approved: "Disetujui",
  needs_review: "Perlu ditinjau",
  pending: "Menunggu",
  rejected: "Ditolak",
};

const TYPE_LABEL: Record<string, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer",
};

export interface TransactionDetailSheetProps {
  /** The transaction to show; keep passing the last one while the sheet animates closed. */
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  walletName: (id: string) => string;
  categoryName: (id: string | null | undefined) => string | null;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onToggleReimbursement?: (transaction: Transaction) => void;
  /** When given, the footer shows Tolak / Tinjau / Setujui in the thumb zone. */
  onStatus?: (transaction: Transaction, status: TransactionStatus) => void;
}

/**
 * Phone and tablet detail for one transaction in the shared bottom sheet: amount, facts,
 * note, then edit/delete/reimbursement actions and the status buttons pinned at the bottom.
 * Every action closes the sheet first so the list underneath shows the result.
 */
export function TransactionDetailSheet({
  transaction: tx,
  open,
  onClose,
  walletName,
  categoryName,
  onEdit,
  onDelete,
  onToggleReimbursement,
  onStatus,
}: TransactionDetailSheetProps) {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const facts = tx
    ? (
        [
          ["Tanggal", dateLabel(tx.transaction_at)],
          ["Tipe", TYPE_LABEL[tx.type] ?? tx.type],
          [tx.type === "transfer" ? "Dompet asal" : "Dompet", walletName(tx.wallet_id)],
          tx.type === "transfer" && tx.destination_wallet_id ? ["Dompet tujuan", walletName(tx.destination_wallet_id)] : null,
          tx.type !== "transfer" ? ["Kategori", categoryName(tx.category_id) ?? "Belum dikategorikan"] : null,
          ["Status", STATUS_LABEL[tx.status] ?? tx.status],
          tx.is_reimbursement
            ? ["Reimbursement", tx.reimbursement_status === "reimbursed" ? "Klaim lunas" : "Piutang, belum cair"]
            : null,
        ] as Array<[string, string] | null>
      ).filter((row): row is [string, string] => row !== null)
    : [];

  return (
    <AppDialog open={open && Boolean(tx)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AppDialogContent size="md">
        {tx ? (
          <>
            <AppDialogHeader>
              <AppDialogDescription className="text-xs font-semibold uppercase tracking-wider">Detail transaksi</AppDialogDescription>
              <AppDialogTitle className="truncate">
                {tx.merchant || (tx.type === "transfer" ? "Transfer antar dompet" : "Tanpa merchant")}
              </AppDialogTitle>
            </AppDialogHeader>

            <AppDialogBody className="pt-0">
              <p
                className={`font-display text-4xl font-semibold ${
                  tx.type === "expense" ? "text-negative" : tx.type === "income" ? "text-positive" : "text-ink"
                }`}
              >
                {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                {amount(tx.amount)}
              </p>

              <dl className="mt-4 divide-y divide-line text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-ink-soft">{label}</dt>
                    <dd className="min-w-0 truncate text-right font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              {tx.note ? <p className="mt-3 rounded-xl surface-raised p-3 text-sm text-ink">{tx.note}</p> : null}

              {onEdit || onDelete || onToggleReimbursement ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {onEdit ? (
                    <button type="button" onClick={run(() => onEdit(tx))} className="btn-secondary flex items-center justify-center gap-1.5">
                      <Edit3 className="size-4" aria-hidden="true" />
                      Edit
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button type="button" onClick={run(() => onDelete(tx))} className="btn-danger flex items-center justify-center gap-1.5">
                      <Trash2 className="size-4" aria-hidden="true" />
                      Hapus
                    </button>
                  ) : null}
                  {onToggleReimbursement && tx.type === "expense" ? (
                    <button type="button" onClick={run(() => onToggleReimbursement(tx))} className="btn-secondary col-span-2">
                      {tx.is_reimbursement ? "Batalkan piutang (belanja pribadi)" : "Tandai piutang (reimbursement)"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </AppDialogBody>

            {onStatus ? (
              <AppDialogFooter className="flex-row gap-2 [&>*]:flex-1">
                <button
                  type="button"
                  disabled={tx.status === "rejected"}
                  onClick={run(() => onStatus(tx, "rejected"))}
                  className="btn-danger flex min-h-12 items-center justify-center gap-1.5 font-semibold"
                >
                  <X className="size-4" aria-hidden="true" />
                  Tolak
                </button>
                <button
                  type="button"
                  disabled={tx.status === "needs_review"}
                  onClick={run(() => onStatus(tx, "needs_review"))}
                  className="btn-secondary flex min-h-12 items-center justify-center gap-1.5 font-semibold"
                >
                  <Clock className="size-4" aria-hidden="true" />
                  Tinjau
                </button>
                <button
                  type="button"
                  disabled={tx.status === "approved"}
                  onClick={run(() => onStatus(tx, "approved"))}
                  className="btn-primary flex min-h-12 items-center justify-center gap-1.5"
                >
                  <Check className="size-4" aria-hidden="true" />
                  Setujui
                </button>
              </AppDialogFooter>
            ) : null}
          </>
        ) : null}
      </AppDialogContent>
    </AppDialog>
  );
}
