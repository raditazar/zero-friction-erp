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
      <AppDialogContent size="xl" className="max-w-4xl max-h-[90vh]">
        <AppDialogHeader className="pdf-modal-controls flex flex-row items-center justify-between border-b border-[#E5E1DB] pb-4">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-[#1A1A1A]" />
            <AppDialogTitle className="text-lg font-bold text-[#1A1A1A]">
              Pratinjau Ekspor PDF Laporan
            </AppDialogTitle>
          </div>
        </AppDialogHeader>

        <AppDialogBody className="bg-[#F4F3EE] p-4 md:p-6 overflow-y-auto">
          {/* Printable Report Area */}
          <div
            id="pdf-report-print-area"
            className="mx-auto max-w-3xl rounded-xl border border-[#E0DDD6] bg-white p-6 md:p-8 shadow-sm text-[#1A1A1A]"
          >
            {/* Header: App Title "Zero-Friction ERP", Report Period, and Generated Date */}
            <header className="border-b border-[#E0DDD6] pb-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded bg-[#1A1A1A] text-[#FBF9F5] text-xs font-bold tracking-wider uppercase mb-1.5">
                    Zero-Friction ERP
                  </span>
                  <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
                    {title}
                  </h1>
                </div>
                <div className="text-left sm:text-right text-xs text-[#5A5A5A] space-y-1">
                  <p className="font-semibold text-[#1A1A1A]">
                    Periode: <span className="font-normal text-[#5A5A5A]">{periodLabel}</span>
                  </p>
                  <p>
                    Dicetak: <span className="font-medium text-[#1A1A1A]">{generatedDate}</span>
                  </p>
                  <p className="text-[11px] text-[#8C8C8C]">Dokumen Laporan Keuangan</p>
                </div>
              </div>
            </header>

            {/* Financial Summary Card */}
            <section className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A5A5A] mb-3">
                Ringkasan Keuangan
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-[#E0DDD6] bg-[#F9F8F5] p-4">
                {/* Total Pemasukan */}
                <div className="rounded-lg bg-white p-3 border border-[#E0DDD6]">
                  <p className="text-xs font-medium text-[#5A5A5A]">Total Pemasukan</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#047857]">
                    +{amount(totalIncome)}
                  </p>
                </div>

                {/* Total Pengeluaran */}
                <div className="rounded-lg bg-white p-3 border border-[#E0DDD6]">
                  <p className="text-xs font-medium text-[#5A5A5A]">Total Pengeluaran</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#B91C1C]">
                    -{amount(totalExpense)}
                  </p>
                </div>

                {/* Net Cashflow */}
                <div className="rounded-lg bg-white p-3 border border-[#E0DDD6]">
                  <p className="text-xs font-medium text-[#5A5A5A]">Net Cashflow</p>
                  <p
                    className={`mt-1 text-lg font-bold tabular-nums ${
                      netCashflow >= 0 ? "text-[#047857]" : "text-[#B91C1C]"
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
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#5A5A5A]">
                  Rincian Transaksi ({transactions.length})
                </h2>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-sm text-[#5A5A5A]">
                  Memuat data laporan...
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#5A5A5A]">
                  Tidak ada transaksi untuk periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#E0DDD6]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E0DDD6] bg-[#F0EEE9] text-[#1A1A1A] font-semibold">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Merchant / Deskripsi</th>
                        <th className="py-2.5 px-3">Dompet</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0DDD6]">
                      {transactions.map((tx, idx) => {
                        const isExpense = tx.type === "expense";
                        const isIncome = tx.type === "income";

                        return (
                          <tr
                            key={tx.id || idx}
                            className={idx % 2 === 1 ? "bg-[#F9F8F5]" : "bg-white"}
                          >
                            <td className="py-2.5 px-3 tabular-nums text-[#5A5A5A] whitespace-nowrap">
                              {dateLabel(tx.transaction_at)}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#1A1A1A]">
                              {tx.merchant || "Tanpa Merchant"}
                            </td>
                            <td className="py-2.5 px-3 text-[#5A5A5A]">
                              {tx.wallet_name || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-[#5A5A5A]">
                              <span className="inline-block rounded bg-[#E8E5DF] px-2 py-0.5 text-[11px] font-medium text-[#1A1A1A]">
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
                                    ? "text-[#B91C1C]"
                                    : isIncome
                                    ? "text-[#047857]"
                                    : "text-[#1A1A1A]"
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
            <footer className="mt-8 border-t border-[#E0DDD6] pt-4 text-center text-[11px] text-[#8C8C8C]">
              Laporan Keuangan Zero-Friction ERP · Di-generate secara otomatis
            </footer>
          </div>
        </AppDialogBody>

        <AppDialogFooter className="pdf-modal-controls flex flex-row items-center justify-end gap-2 border-t border-[#E5E1DB] pt-3">
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
        <span className="inline-flex items-center gap-1 rounded-md bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-medium text-[#065F46] border border-[#A7F3D0]">
          <CheckCircle2 className="size-3" />
          Disetujui
        </span>
      );
    case "needs_review":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-medium text-[#92400E] border border-[#FDE68A]">
          <Clock className="size-3" />
          Ditinjau
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-medium text-[#991B1B] border border-[#FECACA]">
          <XCircle className="size-3" />
          Ditolak
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#374151] border border-[#E5E7EB]">
          <AlertCircle className="size-3" />
          {status}
        </span>
      );
  }
}
