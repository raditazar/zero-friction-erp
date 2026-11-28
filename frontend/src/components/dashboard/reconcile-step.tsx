"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleCheck, Inbox, Scale } from "lucide-react";
import { api, type ReconcilePreview, type Wallet } from "@/lib/api";
import { revalidateFinance, useCategories } from "@/lib/swr";
import { SheetStep } from "@/components/ui/dialog";
import { DateField, FormField, MoneyField, SelectField, TimeField } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { amount, cx } from "./formatters";

/** "dicocokkan hari ini", "… kemarin", "… 12 hari lalu". */
export function reconciledAgo(iso: string | null | undefined, now = new Date()) {
  if (!iso) return "Belum pernah dicocokkan";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Dicocokkan hari ini";
  if (days === 1) return "Dicocokkan kemarin";
  return `Dicocokkan ${days} hari lalu`;
}

function localParts(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/**
 * Under the wallet's balance in its detail sheet: when it was last checked, and the button that
 * opens the matching step inside the same sheet.
 */
export function ReconcileEntry({ wallet }: { wallet: Wallet }) {
  const [preview, setPreview] = useState<ReconcilePreview | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api.reconcilePreview(wallet.id).then(setPreview).catch(() => setPreview(null));
  }, [wallet.id]);
  useEffect(load, [load]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">{preview ? reconciledAgo(preview.last_reconciled?.as_of) : " "}</p>
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs">
          <Scale className="size-3.5" aria-hidden="true" />
          Cocokkan saldo
        </button>
      </div>
      <SheetStep open={open} onBack={() => setOpen(false)} title={`Cocokkan saldo ${wallet.name}`}>
        {open ? (
          <ReconcileForm
            wallet={wallet}
            initial={preview}
            onDone={() => {
              setOpen(false);
              load();
            }}
          />
        ) : null}
      </SheetStep>
    </>
  );
}

function ReconcileForm({ wallet, initial, onDone }: { wallet: Wallet; initial: ReconcilePreview | null; onDone: () => void }) {
  const { data: categories } = useCategories();
  const [actual, setActual] = useState("");
  const [pickDate, setPickDate] = useState(false);
  // "Now" as the form opened; the date picker cannot go past it.
  const [opened] = useState(() => localParts(new Date()));
  const [{ date, time }, setWhen] = useState(opened);
  const [preview, setPreview] = useState<ReconcilePreview | null>(initial);
  const [resolution, setResolution] = useState<"adjustment" | "transaction">("adjustment");
  const [categoryID, setCategoryID] = useState("");
  const [busy, setBusy] = useState(false);

  // A chosen date compares against the balance at that moment; otherwise against now.
  const asOf = pickDate && date ? new Date(`${date}T${time || "23:59"}`).toISOString() : undefined;
  useEffect(() => {
    let live = true;
    api.reconcilePreview(wallet.id, asOf).then((next) => { if (live) setPreview(next); }).catch(() => {});
    return () => { live = false; };
  }, [wallet.id, asOf]);

  const hasActual = actual !== "";
  const appBalance = Number(preview?.app_balance ?? 0);
  const difference = hasActual ? Math.round((Number(actual) - appBalance) * 100) / 100 : 0;
  const matches = hasActual && difference === 0;
  const kind = difference < 0 ? "expense" : "income";
  const categoryOptions = useMemo(() => (categories ?? []).filter((c) => c.type === kind), [categories, kind]);
  const future = pickDate && (date > opened.date || (date === opened.date && time > opened.time));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!hasActual || busy || future) return;
    setBusy(true);
    try {
      const result = await api.reconcileWallet(wallet.id, {
        actual_balance: Number(actual),
        as_of: asOf,
        resolution,
        category_id: resolution === "transaction" ? categoryID || null : null,
      });
      const diff = Number(result.reconciliation.difference);
      toast.success(
        diff === 0
          ? "Saldo cocok, pencocokan dicatat."
          : `Saldo disesuaikan ${diff > 0 ? "+" : "-"}${amount(Math.abs(diff))}.`,
      );
      await revalidateFinance();
      onDone();
    } catch (error) {
      toast.error("Gagal mencocokkan saldo", { detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 pb-6">
      <FormField label="Saldo sebenarnya" required hint="Lihat di aplikasi bank, e-wallet, atau hitung uang tunai.">
        <MoneyField value={actual} onValueChange={setActual} inputMode="numeric" autoFocus />
      </FormField>

      {pickDate ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Per tanggal" error={future ? "Tidak boleh di masa depan." : undefined}>
            <DateField value={date} max={opened.date} onChange={(e) => setWhen({ date: e.target.value, time })} />
          </FormField>
          <FormField label="Jam">
            <TimeField value={time} onChange={(e) => setWhen({ date, time: e.target.value })} />
          </FormField>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
          <span>Per sekarang</span>
          <button type="button" onClick={() => setPickDate(true)} className="font-semibold text-info hover:underline">
            Ubah tanggal
          </button>
        </div>
      )}

      <dl className="grid gap-2 rounded-xl surface-raised p-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-ink-soft">Saldo di app</dt><dd className="tabular-nums text-ink">{preview ? amount(appBalance) : "…"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-soft">Saldo sebenarnya</dt><dd className="tabular-nums text-ink">{hasActual ? amount(actual) : "—"}</dd></div>
        <div className="flex justify-between gap-3 border-t border-line pt-2">
          <dt className="font-semibold text-ink">Selisih</dt>
          <dd className={cx("font-semibold tabular-nums", !hasActual ? "text-ink-soft" : difference < 0 ? "text-negative" : difference > 0 ? "text-positive" : "text-ink")}>
            {!hasActual ? "—" : difference === 0 ? amount(0) : `${difference > 0 ? "+" : "-"}${amount(Math.abs(difference))}`}
          </dd>
        </div>
      </dl>

      {preview && preview.pending_count > 0 && !matches ? (
        <div role="status" className="flex items-start gap-2 rounded-md border border-caution-line bg-caution-soft p-3 text-xs text-caution">
          <Inbox className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="flex-1">
            {preview.pending_count} transaksi di dompet ini masih menunggu di Inbox. Selisihnya mungkin dari situ.{" "}
            <Link href="/inbox" className="font-semibold underline">Cek Inbox dulu</Link>
          </p>
        </div>
      ) : null}

      {matches ? (
        <p className="flex items-center gap-2 rounded-md border border-positive-line bg-positive-soft p-3 text-sm text-positive">
          <CircleCheck className="size-4" aria-hidden="true" /> Saldo cocok. Simpan untuk mencatat pengecekan ini.
        </p>
      ) : hasActual ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs font-semibold text-ink">Catat selisih sebagai</legend>
          <label className={cx("flex cursor-pointer items-start gap-3 rounded-xl p-3", resolution === "adjustment" ? "surface-inset" : "surface-raised")}>
            <input type="radio" name="resolution" className="mt-1" checked={resolution === "adjustment"} onChange={() => setResolution("adjustment")} />
            <span>
              <span className="block text-sm font-semibold text-ink">Penyesuaian saldo</span>
              <span className="block text-xs text-ink-soft">Tidak masuk laporan pemasukan, pengeluaran, atau anggaran.</span>
            </span>
          </label>
          <label className={cx("flex cursor-pointer items-start gap-3 rounded-xl p-3", resolution === "transaction" ? "surface-inset" : "surface-raised")}>
            <input type="radio" name="resolution" className="mt-1" checked={resolution === "transaction"} onChange={() => setResolution("transaction")} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{kind === "expense" ? "Pengeluaran biasa" : "Pemasukan biasa"}</span>
              <span className="block text-xs text-ink-soft">Masuk laporan seperti transaksi lain.</span>
              {resolution === "transaction" ? (
                <SelectField aria-label="Kategori" className="mt-2" value={categoryID} onChange={(e) => setCategoryID(e.target.value)}>
                  <option value="">Tanpa kategori</option>
                  {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectField>
              ) : null}
            </span>
          </label>
        </fieldset>
      ) : null}

      <button type="submit" disabled={!hasActual || busy || future} aria-busy={busy || undefined} className="btn-primary w-full">
        {busy ? "Menyimpan..." : matches ? "Tandai sudah dicocokkan" : "Simpan"}
      </button>
    </form>
  );
}
