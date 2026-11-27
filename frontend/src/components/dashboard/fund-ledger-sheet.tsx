"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { api, type FundEntry, type FundKind, type Wallet } from "@/lib/api";
import {
  AppDialog,
  AppDialogBody,
  AppDialogContent,
  AppDialogDescription,
  AppDialogHeader,
  AppDialogTitle,
} from "@/components/ui/dialog";
import { FormField, MoneyField } from "@/components/ui/form";
import { LoadingState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { amount, dateLabel } from "./formatters";

export type LedgerTarget = {
  kind: FundKind;
  id: string;
  name: string;
  walletID: string | null;
  current: number;
};

const SOURCE_LABEL: Record<FundEntry["source"], string> = {
  opening: "Saldo awal",
  manual: "Setor",
  withdrawal: "Tarik",
  allocation: "Alokasi pemasukan",
  adjustment: "Penyesuaian",
};

/**
 * Deposit into or withdraw from a fund or goal, and its history. The money never leaves the
 * wallet: entries only change how much of the wallet is set aside.
 */
export function FundLedgerSheet({ target, wallets, onClose, onChanged }: { target: LedgerTarget | null; wallets: Wallet[]; onClose: () => void; onChanged: () => void }) {
  return (
    <AppDialog open={Boolean(target)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AppDialogContent size="md">
        {target ? <LedgerBody key={`${target.kind}:${target.id}`} target={target} wallets={wallets} onChanged={onChanged} /> : null}
      </AppDialogContent>
    </AppDialog>
  );
}

function LedgerBody({ target, wallets, onChanged }: { target: LedgerTarget; wallets: Wallet[]; onChanged: () => void }) {
  const [entries, setEntries] = useState<FundEntry[] | null>(null);
  const [current, setCurrent] = useState(target.current);
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const walletName = target.walletID ? wallets.find((wallet) => wallet.id === target.walletID)?.name : null;

  const load = useCallback(() => {
    api.fundEntries(target.kind, target.id)
      .then((rows) => {
        setEntries(rows);
        setCurrent(rows.reduce((total, entry) => total + Number(entry.amount), 0));
      })
      .catch((error) => {
        setEntries([]);
        toast.error("Riwayat belum dapat dimuat", { detail: error instanceof Error ? error.message : undefined });
      });
  }, [target.kind, target.id]);

  useEffect(load, [load]);

  const entered = Number(value || 0);
  const tooMuch = direction === "withdraw" && entered > current;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || entered <= 0 || tooMuch) return;
    setBusy(true);
    try {
      await api.createFundEntry(target.kind, target.id, { type: direction, amount: entered });
      toast.success(direction === "deposit" ? `Disetor ${amount(entered)}.` : `Ditarik ${amount(entered)}.`);
      setValue("");
      load();
      onChanged();
    } catch (error) {
      toast.error(direction === "deposit" ? "Gagal menyetor" : "Gagal menarik", { detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: FundEntry) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteFundEntry(entry.id);
      toast.success("Entri dihapus.");
      load();
      onChanged();
    } catch (error) {
      toast.error("Gagal menghapus entri", { detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppDialogHeader>
        <AppDialogDescription className="text-xs font-semibold uppercase tracking-wider">Setor / tarik</AppDialogDescription>
        <AppDialogTitle className="truncate">{target.name}</AppDialogTitle>
      </AppDialogHeader>
      <AppDialogBody className="grid gap-4 pt-0">
        <div>
          <p className="font-display text-3xl font-semibold tabular-nums text-ink">{amount(current)}</p>
          <p className="text-xs text-ink-soft">{walletName ? `Disisihkan di ${walletName}. Uangnya tetap di dompet itu.` : "Belum terhubung ke dompet; pilih dompet lewat Edit agar saldo tersedia ikut terhitung."}</p>
        </div>

        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis entri">
            <button type="button" role="radio" aria-checked={direction === "deposit"} onClick={() => setDirection("deposit")} className={direction === "deposit" ? "btn-primary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"}>Setor</button>
            <button type="button" role="radio" aria-checked={direction === "withdraw"} onClick={() => setDirection("withdraw")} className={direction === "withdraw" ? "btn-primary px-3 py-2 text-xs" : "btn-secondary px-3 py-2 text-xs"}>Tarik</button>
          </div>
          <FormField label="Jumlah" required error={tooMuch ? `Maksimal ${amount(current)}.` : undefined}>
            <MoneyField value={value} onValueChange={setValue} inputMode="numeric" />
          </FormField>
          <button type="submit" disabled={busy || entered <= 0 || tooMuch} aria-busy={busy || undefined} className="btn-primary w-full">
            {busy ? "Menyimpan..." : direction === "deposit" ? "Setor ke dana" : "Tarik dari dana"}
          </button>
        </form>

        <div>
          <p className="eyebrow mb-2">Riwayat</p>
          {entries === null ? <LoadingState variant="list" rows={3} label="Memuat riwayat" /> : entries.length === 0 ? (
            <p className="text-sm text-ink-soft">Belum ada setoran.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {entries.map((entry) => {
                const value = Number(entry.amount);
                return (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{SOURCE_LABEL[entry.source] ?? entry.source}</p>
                      <p className="truncate text-xs text-ink-soft">{dateLabel(entry.entry_at)}{entry.note && entry.note !== SOURCE_LABEL[entry.source] ? ` · ${entry.note}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`tabular-nums font-semibold ${value < 0 ? "text-negative" : "text-positive"}`}>{value < 0 ? "-" : "+"}{amount(Math.abs(value))}</span>
                      {entry.source !== "allocation" ? (
                        <button type="button" disabled={busy} onClick={() => void remove(entry)} className="rounded-md p-1.5 text-ink-soft hover:text-negative" aria-label={`Hapus entri ${SOURCE_LABEL[entry.source]}`}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AppDialogBody>
    </>
  );
}
