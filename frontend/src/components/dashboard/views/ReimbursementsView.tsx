"use client";

import type { Category, Transaction, Wallet } from "@/lib/api";
import { amount, shortID } from "../formatters";
import { EmptyState, Panel } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";

type Props = {
  reimbursements: Transaction[];
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  onMark: (id: string) => void;
  onSettle: (id: string) => void;
};

export function ReimbursementsView({
  reimbursements,
  walletById,
  categoryById,
  onMark,
  onSettle,
}: Props) {
  const pendingItems = reimbursements.filter(
    (t) => t.reimbursement_status === "receivable" || t.reimbursement_status === "partially_reimbursed"
  );
  const settledItems = reimbursements.filter((t) => t.reimbursement_status === "reimbursed");

  const totalReceivable = pendingItems.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const totalReimbursed = settledItems.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  return (
    <InfoTooltipProvider>
      <div className="grid gap-6">
        {/* Metric Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#E0DDD6] bg-[#F0EEE9] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A5A5A] uppercase tracking-wider">
              <span>Aset Piutang Berjalan</span>
              <InfoTooltip content="Total pengeluaran out-of-pocket yang belum direimburse. Dikecualikan dari pengeluaran pribadi (DEC-05)." />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[#1A1A1A] tabular-nums">
              {amount(totalReceivable)}
            </p>
            <p className="mt-1 text-xs text-[#5A5A5A] font-medium">
              {pendingItems.length} Klaim Belum Cair
            </p>
          </div>

          <div className="rounded-xl border border-[#E0DDD6] bg-[#F0EEE9] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A5A5A] uppercase tracking-wider">
              <span>Total Pelunasan / Cair</span>
              <InfoTooltip content="Total dana reimbursement yang telah berhasil dicairkan kembali ke rekening." />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[#059669] tabular-nums">
              {amount(totalReimbursed)}
            </p>
            <p className="mt-1 text-xs text-[#5A5A5A] font-medium">
              {settledItems.length} Klaim Selesai
            </p>
          </div>

          <div className="rounded-xl border border-[#E0DDD6] bg-[#F0EEE9] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A5A5A] uppercase tracking-wider">
              <span>Status Proteksi Analytics</span>
              <InfoTooltip content="Semua klaim piutang diisolasi secara finansial agar tidak merusak grafik budget bulanan Anda." />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#1A1A1A]">
              100% Terisolasi
            </p>
            <p className="mt-1 text-xs text-[#059669] font-semibold">
              ✓ Zero Impact on Personal Expenses
            </p>
          </div>
        </div>

        {/* Reimbursement Claims Table Panel */}
        <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
          <div className="panel-head mb-6">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="eyebrow text-[#5A5A5A]">Daftar Klaim & Reimbursable Assets</p>
                <InfoTooltip content="Klik 'Tandai Lunas' saat dana reimbursement telah diterima di dompet/rekening Anda." />
              </div>
              <h3 className="section-title text-[#1A1A1A] text-xl font-bold">
                {reimbursements.length} Total Klaim Terdaftar
              </h3>
            </div>
          </div>

          {reimbursements.length === 0 ? (
            <EmptyState
              title="Belum Ada Klaim Reimbursement"
              body="Tandai transaksi saat menginput atau di Kotak Masuk sebagai Reimbursement untuk melacak piutang secara terpisah."
            />
          ) : (
            <div className="grid gap-3">
              {reimbursements.map((transaction) => {
                const isPending =
                  transaction.reimbursement_status === "receivable" ||
                  transaction.reimbursement_status === "partially_reimbursed";
                return (
                  <div
                    key={transaction.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-[#1A1A1A] truncate">
                          {transaction.merchant || "Transaksi Tanpa Nama"}
                        </h4>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                            isPending
                              ? "bg-[#FEF3C7] text-[#92400E]"
                              : "bg-[#D1FAE5] text-[#065F46]"
                          }`}
                        >
                          {transaction.reimbursement_status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#5A5A5A]">
                        Dompet:{" "}
                        <span className="font-semibold text-[#1A1A1A]">
                          {walletById.get(transaction.wallet_id)?.name || shortID(transaction.wallet_id)}
                        </span>{" "}
                        • Kategori:{" "}
                        <span className="font-semibold text-[#1A1A1A]">
                          {categoryById.get(transaction.category_id || "")?.name || "Tanpa Kategori"}
                        </span>
                        {transaction.note ? ` • Catatan: ${transaction.note}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="text-xl font-extrabold text-[#1A1A1A] tabular-nums">
                        {amount(transaction.amount)}
                      </p>
                      {isPending ? (
                        <button className="btn-primary py-2 px-3 text-xs" onClick={() => onSettle(transaction.id)}>
                          ✓ Tandai Lunas (Settle)
                        </button>
                      ) : (
                        <button className="btn-secondary py-2 px-3 text-xs" onClick={() => onMark(transaction.id)}>
                          Buka Kembali (Receivable)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </InfoTooltipProvider>
  );
}
