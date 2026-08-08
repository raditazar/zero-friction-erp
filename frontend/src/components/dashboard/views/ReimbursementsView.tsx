"use client";

import { BadgeCheck, CircleDollarSign, Clock3 } from "lucide-react";
import type { Category, Transaction, Wallet } from "@/lib/api";
import { MetricCard } from "@/components/ui/cards/metric-card";
import { Panel } from "@/components/ui/dashboard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { amount, shortID } from "../formatters";

type Props = { reimbursements: Transaction[]; walletById: Map<string, Wallet>; categoryById: Map<string, Category>; onMark: (id: string) => void; onSettle: (id: string) => void; loading?: boolean; error?: string; actionId?: string | null; onRetry?: () => void };
const isReceivable = (transaction: Transaction) => transaction.reimbursement_status === "receivable" || transaction.reimbursement_status === "partially_reimbursed";

export function ReimbursementsView({ reimbursements, walletById, categoryById, onMark, onSettle, loading = false, error = "", actionId = null, onRetry }: Props) {
  const pendingItems = reimbursements.filter(isReceivable);
  const settledItems = reimbursements.filter((transaction) => transaction.reimbursement_status === "reimbursed");
  const totalReceivable = pendingItems.reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const totalReimbursed = settledItems.reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

  return <InfoTooltipProvider><div className="grid gap-6">
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Piutang berjalan" value={amount(totalReceivable)} subtitle={`${pendingItems.length} klaim belum cair`} icon={CircleDollarSign} />
      <MetricCard label="Sudah cair" value={amount(totalReimbursed)} subtitle={`${settledItems.length} klaim selesai`} icon={BadgeCheck} />
      <MetricCard label="Basis analytics" value="Terlindungi" subtitle="Piutang tidak dihitung sebagai belanja pribadi" icon={Clock3} />
    </div>
    <Panel className="bg-[#FFFFFF]"><div className="panel-head mb-6"><div><div className="flex items-center gap-1.5"><p className="eyebrow">Daftar klaim</p><InfoTooltip content="Tandai lunas hanya setelah dana reimbursement benar-benar diterima pada rekening Anda." /></div><h3 className="section-title">{reimbursements.length} total klaim</h3></div></div>
      {error ? <ErrorState message={error} title="Piutang perlu dimuat ulang" onRetry={onRetry} /> : null}
      {loading ? <LoadingState variant="table" label="Memuat daftar piutang..." /> : null}
      {!loading && !error && reimbursements.length === 0 ? <EmptyState title="Belum ada reimbursement" description="Tandai transaksi yang dapat diklaim untuk melacak dana yang perlu kembali." /> : null}
      {!loading && !error && reimbursements.length > 0 ? <div className="grid gap-3">{reimbursements.map((transaction) => {
        const pending = isReceivable(transaction); const isSubmitting = actionId === transaction.id;
        return <article key={transaction.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-4 shadow-sm transition-colors hover:bg-[#F9F8F5]"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-base font-bold text-[#1A1A1A]">{transaction.merchant || "Transaksi tanpa nama"}</h4><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${pending ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]" : "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"}`}>{pending ? "Belum cair" : "Lunas"}</span></div><p className="mt-1 text-xs leading-5 text-[#6E6D7A]">Dompet <span className="font-semibold text-[#1A1A1A]">{walletById.get(transaction.wallet_id)?.name || shortID(transaction.wallet_id)}</span>{" · "}Kategori <span className="font-semibold text-[#1A1A1A]">{categoryById.get(transaction.category_id || "")?.name || "Tanpa kategori"}</span>{transaction.note ? ` · ${transaction.note}` : ""}</p></div><div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end"><p className="text-xl font-extrabold tabular-nums text-[#1A1A1A]">{amount(transaction.amount)}</p><button type="button" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={pending ? "btn-primary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"} onClick={() => pending ? onSettle(transaction.id) : onMark(transaction.id)}>{isSubmitting ? "Memproses..." : pending ? "Tandai lunas" : "Buka kembali"}</button></div></article>;
      })}</div> : null}
    </Panel>
  </div></InfoTooltipProvider>;
}
