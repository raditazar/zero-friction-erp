"use client";

import React, { useMemo } from "react";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogBody,
  AppDialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { amount, dateLabel } from "@/components/dashboard/formatters";

export type PdfReportTransaction = {
  id: string;
  transaction_at: string;
  merchant: string | null;
  wallet_name: string;
  category_name: string;
  status: "approved" | "needs_review" | "rejected" | "pending" | string;
  type: "income" | "expense" | "transfer" | string;
  amount: number | string;
};

export type PdfReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  periodLabel?: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  transactions: PdfReportTransaction[];
  isLoading?: boolean;
};

export function PdfReportModal({
  isOpen,
  onClose,
  title = "Laporan Transaksi & Keuangan",
  periodLabel = "Semua Periode",
  totalIncome,
  totalExpense,
  netCashflow,
  transactions,
  isLoading = false,
}: PdfReportModalProps) {
  const generatedDate = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date());
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AppDialogContent size="xl" className="max-w-4xl max-h-[90dvh]">
        <AppDialogHeader className="pdf-modal-controls flex flex-row items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-ink" />
            <AppDialogTitle className="text-lg font-bold text-ink">
              Pratinjau Ekspor PDF Laporan
            </AppDialogTitle>
          </div>
        </AppDialogHeader>

        <AppDialogBody className="bg-paper p-4 md:p-6 overflow-y-auto">
          {/* Printable Report Area */}
          <div
            id="pdf-report-print-area"
            className="mx-auto max-w-3xl rounded-xl surface-raised p-6 md:p-8 text-ink"
          >
            {/* Header: App Title "satSet ERP", Report Period, and Generated Date */}
            <header className="border-b border-line pb-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase mb-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="satset Logo" className="size-4 object-contain rounded" />
                    <span>satset ERP</span>
                  </div>
                  <h1 className="text-2xl font-bold text-ink tracking-tight">
                    {title}
                  </h1>
                </div>
                <div className="text-left sm:text-right text-xs text-ink-soft space-y-1">
                  <p className="font-semibold text-ink">
                    Periode: <span className="font-normal text-ink-soft">{periodLabel}</span>
                  </p>
                  <p>
                    Dicetak: <span className="font-medium text-ink">{generatedDate}</span>
                  </p>
                  <p className="text-xs text-ink-faint">Dokumen Laporan Keuangan</p>
                </div>
              </div>
            </header>

            {/* Financial Summary Card */}
            <section className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">
                Ringkasan Keuangan
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-line bg-paper p-4">
                {/* Total Pemasukan */}
                <div className="rounded-lg bg-card p-3 border border-line">
                  <p className="text-xs font-medium text-ink-soft">Total Pemasukan</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-positive">
                    +{amount(totalIncome)}
                  </p>
                </div>

                {/* Total Pengeluaran */}
                <div className="rounded-lg bg-card p-3 border border-line">
                  <p className="text-xs font-medium text-ink-soft">Total Pengeluaran</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-negative">
                    -{amount(totalExpense)}
                  </p>
                </div>

                {/* Net Cashflow */}
                <div className="rounded-lg bg-card p-3 border border-line">
                  <p className="text-xs font-medium text-ink-soft">Net Cashflow</p>
                  <p
                    className={`mt-1 text-lg font-bold tabular-nums ${
                      netCashflow >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {netCashflow >= 0 ? "+" : ""}{amount(netCashflow)}
                  </p>
                </div>
              </div>
            </section>

            {/* Styled Transactions Table */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  Rincian Transaksi ({transactions.length})
                </h2>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-sm text-ink-soft">
                  Memuat data laporan...
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-soft">
                  Tidak ada transaksi untuk periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-line bg-paper-sunk text-ink font-semibold">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Merchant / Deskripsi</th>
                        <th className="py-2.5 px-3">Dompet</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {transactions.map((tx, idx) => {
                        const isExpense = tx.type === "expense";
                        const isIncome = tx.type === "income";

                        return (
                          <tr
                            key={tx.id || idx}
                            className={idx % 2 === 1 ? "bg-paper" : "bg-card"}
                          >
                            <td className="py-2.5 px-3 tabular-nums text-ink-soft whitespace-nowrap">
                              {dateLabel(tx.transaction_at)}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-ink">
                              {tx.merchant || "Tanpa Merchant"}
                            </td>
                            <td className="py-2.5 px-3 text-ink-soft">
                              {tx.wallet_name || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-ink-soft">
                              <span className="inline-block rounded bg-paper-sunk px-2 py-0.5 text-xs font-medium text-ink">
                                {tx.category_name || "Umum"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {renderStatusBadge(tx.status)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  isExpense
                                    ? "text-negative"
                                    : isIncome
                                    ? "text-positive"
                                    : "text-ink"
                                }
                              >
                                {isExpense ? "-" : isIncome ? "+" : ""}
                                {amount(tx.amount)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Footer */}
            <footer className="mt-8 border-t border-line pt-4 text-center text-xs text-ink-faint">
              Laporan Keuangan satset ERP · Di-generate secara otomatis
            </footer>
          </div>
        </AppDialogBody>

        <AppDialogFooter className="pdf-modal-controls flex flex-row items-center justify-end gap-2 border-t border-line pt-3">
          <Button
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2"
          >
            Tutup
          </Button>
          <Button
            onClick={handlePrint}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <Printer className="size-4" />
            Cetak / Simpan PDF
          </Button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}

function renderStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-positive-soft px-2 py-0.5 text-xs font-medium text-positive border border-positive-line">
          <CheckCircle2 className="size-3" />
          Disetujui
        </span>
      );
    case "needs_review":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-caution-soft px-2 py-0.5 text-xs font-medium text-caution border border-caution-line">
          <Clock className="size-3" />
          Ditinjau
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-negative-soft px-2 py-0.5 text-xs font-medium text-negative border border-negative-line">
          <XCircle className="size-3" />
          Ditolak
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F4F6] px-2 py-0.5 text-xs font-medium text-[#374151] border border-[#E5E7EB]">
          <AlertCircle className="size-3" />
          {status}
        </span>
      );
  }
}
