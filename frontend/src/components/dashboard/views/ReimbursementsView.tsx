"use client";

import { useState, type FormEvent } from "react";
import { BadgeCheck, CircleDollarSign, Hourglass } from "lucide-react";
import type { Category, ReimbursementClaim, SettleReimbursementPayload, Wallet } from "@/lib/api";
import { MetricCard } from "@/components/ui/cards/metric-card";
import { Panel } from "@/components/ui/dashboard";
import {
  AppDialog,
  AppDialogBody,
  AppDialogContent,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { FormField, MoneyField, SelectField } from "@/components/ui/form";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { amount, shortID } from "../formatters";

type Props = {
  claims: ReimbursementClaim[];
  wallets: Wallet[];
  categoryById: Map<string, Category>;
  onSettle: (id: string, payload: SettleReimbursementPayload) => Promise<boolean>;
  onIgnore: (id: string) => void;
  onReopen: (id: string) => void;
  onOpenLedger: () => void;
  loading?: boolean;
  /** Load failure only; action failures are toasts so the list stays visible. */
  error?: string;
  actionId?: string | null;
  onRetry?: () => void;
};

const STATUS: Record<string, { label: string; tone: string }> = {
  receivable: { label: "Belum cair", tone: "border-caution-line bg-caution-soft text-caution" },
  partially_reimbursed: { label: "Sebagian cair", tone: "border-caution-line bg-caution-soft text-caution" },
  reimbursed: { label: "Lunas", tone: "border-positive-line bg-positive-soft text-positive" },
  ignored: { label: "Diabaikan", tone: "border-line bg-paper text-ink-soft" },
};

const num = (value: string | number | undefined) => Number(value || 0);
const isOpen = (claim: ReimbursementClaim) =>
  claim.reimbursement_status === "receivable" || claim.reimbursement_status === "partially_reimbursed";

export function ReimbursementsView({ claims, wallets, categoryById, onSettle, onIgnore, onReopen, onOpenLedger, loading = false, error = "", actionId = null, onRetry }: Props) {
  const [settling, setSettling] = useState<ReimbursementClaim | null>(null);
  const walletById = new Map(wallets.map((wallet) => [wallet.id, wallet]));

  const openClaims = claims.filter(isOpen);
  const outstanding = openClaims.reduce((total, claim) => total + num(claim.outstanding), 0);
  const received = claims
    .filter((claim) => claim.reimbursement_status !== "ignored")
    .reduce((total, claim) => total + num(claim.received), 0);
  const partial = claims.filter((claim) => claim.reimbursement_status === "partially_reimbursed");
  const settledCount = claims.filter((claim) => claim.reimbursement_status === "reimbursed").length;

  return <InfoTooltipProvider><div className="grid gap-6">
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Belum kembali" value={amount(outstanding)} subtitle={`${openClaims.length} klaim terbuka`} icon={CircleDollarSign} />
      <MetricCard label="Sudah kembali" value={amount(received)} subtitle={`${settledCount} klaim lunas`} icon={BadgeCheck} />
      <MetricCard label="Sebagian cair" value={String(partial.length)} subtitle={partial.length ? `Sisa ${amount(partial.reduce((t, c) => t + num(c.outstanding), 0))}` : "Tidak ada pembayaran parsial"} icon={Hourglass} />
    </div>
    <Panel className="bg-card"><div className="panel-head mb-6"><div><div className="flex items-center gap-1.5"><p className="eyebrow">Daftar klaim</p><InfoTooltip content="Klaim tidak dihitung sebagai belanja pribadi, dan uang penggantinya tidak dihitung sebagai pemasukan." /></div><h3 className="section-title">{claims.length} total klaim</h3></div></div>
      {error ? <ErrorState message={error} title="Piutang perlu dimuat ulang" onRetry={onRetry} /> : null}
      {loading && !claims.length ? <LoadingState variant="table" label="Memuat daftar piutang..." /> : null}
      {!loading && !error && claims.length === 0 ? <EmptyState title="Belum ada klaim reimbursement" description="Buka transaksi pengeluaran di Buku Besar lalu pilih “Tandai piutang” untuk melacak uang yang perlu kembali." action={{ label: "Buka Buku Besar", onClick: onOpenLedger }} /> : null}
      {claims.length > 0 ? <div className="grid gap-3">{claims.map((claim) => {
        const status = STATUS[claim.reimbursement_status] ?? STATUS.receivable;
        const open = isOpen(claim);
        const busy = actionId === claim.id;
        const share = num(claim.claimed) > 0 ? Math.min(100, (num(claim.received) / num(claim.claimed)) * 100) : 0;
        return <article key={claim.id} className="grid gap-3 rounded-xl surface-raised p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-base font-bold text-ink">{claim.merchant || "Transaksi tanpa nama"}</h4><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${status.tone}`}>{status.label}</span></div>
              <p className="mt-1 text-xs leading-5 text-ink-soft">Dompet <span className="font-semibold text-ink">{walletById.get(claim.wallet_id)?.name || shortID(claim.wallet_id)}</span>{" · "}Kategori <span className="font-semibold text-ink">{categoryById.get(claim.category_id || "")?.name || "Tanpa kategori"}</span>{claim.note ? ` · ${claim.note}` : ""}</p>
            </div>
            <p className="shrink-0 text-xl font-extrabold tabular-nums text-ink">{amount(claim.claimed)}</p>
          </div>
          {num(claim.received) > 0 ? <div className="grid gap-1.5">
            <p className="flex justify-between gap-3 text-xs tabular-nums text-ink-soft"><span>Kembali {amount(claim.received)}</span>{open ? <span>Sisa <span className="font-semibold text-ink">{amount(claim.outstanding)}</span></span> : null}</p>
            {open ? <div className="h-1.5 overflow-hidden rounded-full bg-paper-sunk" role="progressbar" aria-label="Bagian klaim yang sudah kembali" aria-valuenow={Math.round(share)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-positive-solid" style={{ width: `${share}%` }} /></div> : null}
          </div> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {open ? <>
              <button type="button" disabled={busy} className="btn-secondary px-3 py-2 text-xs" onClick={() => onIgnore(claim.id)}>Abaikan</button>
              <button type="button" disabled={busy} aria-busy={busy || undefined} className="btn-primary px-3 py-2 text-xs" onClick={() => setSettling(claim)}>{busy ? "Memproses..." : "Catat pelunasan"}</button>
            </> : <button type="button" disabled={busy} aria-busy={busy || undefined} className="btn-secondary px-3 py-2 text-xs" onClick={() => onReopen(claim.id)}>{busy ? "Memproses..." : "Buka kembali"}</button>}
          </div>
        </article>;
      })}</div> : null}
    </Panel>
    <SettleSheet claim={settling} wallets={wallets} busy={Boolean(settling && actionId === settling.id)} onClose={() => setSettling(null)} onSubmit={async (payload) => {
      if (!settling) return;
      if (await onSettle(settling.id, payload)) setSettling(null);
    }} />
  </div></InfoTooltipProvider>;
}

function SettleSheet({ claim, wallets, busy, onClose, onSubmit }: { claim: ReimbursementClaim | null; wallets: Wallet[]; busy: boolean; onClose: () => void; onSubmit: (payload: SettleReimbursementPayload) => void }) {
  return <AppDialog open={Boolean(claim)} onOpenChange={(next) => { if (!next) onClose(); }}>
    <AppDialogContent size="md">
      {claim ? <SettleForm key={claim.id} claim={claim} wallets={wallets} busy={busy} onSubmit={onSubmit} /> : null}
    </AppDialogContent>
  </AppDialog>;
}

function SettleForm({ claim, wallets, busy, onSubmit }: { claim: ReimbursementClaim; wallets: Wallet[]; busy: boolean; onSubmit: (payload: SettleReimbursementPayload) => void }) {
  const outstanding = num(claim.outstanding);
  const [walletID, setWalletID] = useState(claim.wallet_id);
  const [value, setValue] = useState(String(Math.round(outstanding)));
  const [recordMoney, setRecordMoney] = useState(true);
  const entered = Number(value || 0);
  const invalid = recordMoney && (!walletID || entered <= 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || invalid) return;
    onSubmit(recordMoney ? { wallet_id: walletID, amount: entered } : {});
  }

  return <form onSubmit={submit}>
    <AppDialogHeader>
      <AppDialogDescription className="text-xs font-semibold uppercase tracking-wider">Catat pelunasan</AppDialogDescription>
      <AppDialogTitle className="truncate">{claim.merchant || "Klaim reimbursement"}</AppDialogTitle>
    </AppDialogHeader>
    <AppDialogBody className="grid gap-4 pt-0">
      <p className="text-sm text-ink-soft">Klaim {amount(claim.claimed)}{num(claim.received) > 0 ? `, sudah kembali ${amount(claim.received)}` : ""}. Sisa <span className="font-semibold text-ink">{amount(outstanding)}</span>.</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cara melunasi">
        <button type="button" role="radio" aria-checked={recordMoney} onClick={() => setRecordMoney(true)} className={recordMoney ? "btn-primary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"}>Catat uang masuk</button>
        <button type="button" role="radio" aria-checked={!recordMoney} onClick={() => setRecordMoney(false)} className={!recordMoney ? "btn-primary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"}>Tandai lunas saja</button>
      </div>
      {recordMoney ? <>
        <FormField label="Masuk ke dompet" required>
          <SelectField value={walletID} onChange={(event) => setWalletID(event.target.value)}>
            {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
          </SelectField>
        </FormField>
        <FormField label="Jumlah diterima" required hint={entered > 0 && entered < outstanding ? `Sebagian: sisa ${amount(outstanding - entered)} tetap tercatat sebagai piutang.` : "Dicatat sebagai pemasukan pengganti, bukan pemasukan pribadi."}>
          <MoneyField value={value} onValueChange={setValue} inputMode="numeric" />
        </FormField>
      </> : <p className="rounded-xl surface-raised p-3 text-sm text-ink">Klaim ditutup tanpa mencatat uang masuk, misalnya bila penggantinya sudah tercatat di transaksi lain atau dibayar tunai.</p>}
    </AppDialogBody>
    <AppDialogFooter>
      <button type="submit" disabled={busy || invalid} aria-busy={busy || undefined} className="btn-primary w-full">{busy ? "Menyimpan..." : recordMoney ? "Simpan pelunasan" : "Tandai lunas"}</button>
    </AppDialogFooter>
  </form>;
}
