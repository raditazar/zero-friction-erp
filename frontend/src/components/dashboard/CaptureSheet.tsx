"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Building2, Camera, ClipboardPaste, Images, PencilLine, Type, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { AppDialog, AppDialogBody, AppDialogContent, AppDialogDescription, AppDialogFooter, AppDialogTitle } from "@/components/ui/dialog";
import { DateField, FormField, MoneyField, NativeSelectField, SubmitAction, TextField } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { useCategories, useWallets } from "@/lib/swr";

export type CaptureMode = "photo" | "text" | "transfer" | "manual";

interface CaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Mode to show when the sheet opens; defaults to the last one used. */
  initialMode?: CaptureMode;
}

const MODES: Array<{ id: CaptureMode; label: string; icon: LucideIcon }> = [
  { id: "photo", label: "Foto", icon: Camera },
  { id: "text", label: "Teks", icon: Type },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
  { id: "manual", label: "Manual", icon: PencilLine },
];

const MODE_KEY = "zfe-capture-mode";

function rememberedMode(): CaptureMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return MODES.some((mode) => mode.id === value) ? (value as CaptureMode) : "text";
  } catch {
    return "text";
  }
}

function readAsBase64(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Berkas tidak bisa dibaca."));
    reader.readAsDataURL(file);
  });
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** A paper receipt with a mint scan line sweeping over it while OCR runs. */
function ReceiptScan({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-6">
      <div className="relative h-40 w-28 text-ink">
        <svg viewBox="0 0 112 160" className="h-full w-full" fill="none" aria-hidden="true">
          <path
            d="M10 6h92v140l-11.5 8-11.5-8-11.5 8-11.5-8-11.5 8-11.5-8L21.5 154 10 146V6Z"
            className="fill-card stroke-current"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M26 30h60M26 48h44M26 66h60M26 84h36M26 110h60" className="stroke-line-strong" strokeWidth="5" strokeLinecap="round" />
          <path d="M62 126h24" className="stroke-current" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-0 h-1.5 rounded-full bg-mint shadow-[0_0_18px_4px_var(--mint)]"
          initial={{ top: "6%" }}
          animate={{ top: ["6%", "86%", "6%"] }}
          transition={{ duration: 1.9, ease: "easeInOut", repeat: Infinity }}
        />
      </div>
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="-mt-3 text-xs text-ink-soft">Biasanya beberapa detik. Jangan tutup lembar ini.</p>
    </div>
  );
}

function ReimbursementSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-2.5">
      <Building2 className="size-5 shrink-0 text-caution" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">Klaim kantor</span>
        <span className="block text-xs text-ink-soft">Catat sebagai piutang reimbursement</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-card after:shadow after:transition-transform peer-checked:bg-caution-solid peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-positive"
      />
    </label>
  );
}

/** "Catat": one sheet, four ways to record a transaction (photo, free text, transfer, manual form). */
export function CaptureSheet({ open, onOpenChange, onSuccess, initialMode }: CaptureSheetProps) {
  const formId = useId();
  const [mode, setMode] = useState<CaptureMode>("text");
  const [busy, setBusy] = useState(false);
  const [scanLabel, setScanLabel] = useState("");
  const [error, setError] = useState("");
  const busyRef = useRef(false); // guards against double capture before React re-renders

  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();

  // Shared
  const [isReimbursement, setIsReimbursement] = useState(false);
  // Teks
  const [text, setText] = useState("");
  // Transfer + Manual
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [note, setNote] = useState("");
  // Manual
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(today);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setMode(initialMode ?? rememberedMode());
    setError("");
    setText("");
    setAmount("");
    setNote("");
    setCategoryId("");
    setIsReimbursement(false);
    setDate(today());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialMode]);

  const fromWallet = walletId || wallets[0]?.id || "";
  const destWallet = toWalletId && toWalletId !== fromWallet ? toWalletId : wallets.find((wallet) => wallet.id !== fromWallet)?.id || "";

  function switchMode(next: CaptureMode) {
    if (busy) return;
    haptics.tap();
    setMode(next);
    setError("");
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* storage blocked */
    }
  }

  /** Runs one capture at a time; a second tap while busy is ignored. */
  async function run(task: () => Promise<string>, failTitle: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const message = await task();
      haptics.success();
      toast.success(message);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Coba lagi sebentar.";
      haptics.warn();
      setError(detail);
      toast.error(failTitle, { detail });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setScanLabel("");
    }
  }

  function extractImage(file: Blob, source: string) {
    setScanLabel(`Membaca ${source}…`);
    return run(async () => {
      const res = await api.extractTransaction({ image_base64: await readAsBase64(file), image_mime: file.type || "image/jpeg" });
      if (isReimbursement && res.transaction?.id) await api.markReimbursement(res.transaction.id).catch(() => {});
      return `Masuk Kotak Masuk: ${res.transaction?.merchant || "struk"}`;
    }, "Struk tidak terbaca");
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>, source: string) {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same file again must fire change
    if (file) void extractImage(file, source);
  }

  async function handlePaste() {
    if (busyRef.current) return;
    haptics.tap();
    try {
      if (typeof navigator.clipboard?.read === "function") {
        try {
          for (const item of await navigator.clipboard.read()) {
            const imageType = item.types.find((type) => type.startsWith("image/"));
            if (imageType) {
              void extractImage(await item.getType(imageType), "tangkapan layar");
              return;
            }
          }
        } catch {
          /* image access denied: fall back to text below */
        }
      }
      const pasted = (await navigator.clipboard?.readText?.())?.trim();
      if (pasted) {
        setText(pasted);
        setMode("text");
        toast.info("Teks ditempel. Periksa lalu simpan.");
      } else {
        toast.info("Papan klip kosong.");
      }
    } catch (err) {
      toast.error("Papan klip tidak bisa dibaca", { detail: err instanceof Error ? err.message : undefined });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (mode === "text") {
      const clean = text.trim();
      if (!clean) return;
      void run(async () => {
        const res = await api.extractTransaction(isReimbursement ? `${clean} (reimbursement kantor)` : clean);
        if (isReimbursement && res.transaction?.id) await api.markReimbursement(res.transaction.id).catch(() => {});
        return `Masuk Kotak Masuk: ${res.transaction?.merchant || "transaksi"}`;
      }, "Teks tidak bisa dibaca");
      return;
    }

    // MoneyField hands back raw digits, so "100.000" on screen is 100000 here.
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Isi nominal lebih dari nol.");
      return;
    }
    const at = new Date(`${date || today()}T${new Date().toTimeString().slice(0, 8)}`).toISOString();

    if (mode === "transfer") {
      if (!fromWallet || !destWallet) {
        setError("Pilih dua dompet yang berbeda.");
        return;
      }
      void run(async () => {
        await api.createTransfer({
          wallet_id: fromWallet,
          destination_wallet_id: destWallet,
          amount: value,
          transaction_at: new Date().toISOString(),
          note: note.trim() || "Transfer antar dompet",
          status: "approved",
        });
        return "Transfer tercatat.";
      }, "Transfer gagal dicatat");
      return;
    }

    if (!fromWallet) {
      setError("Pilih dompet dulu.");
      return;
    }
    void run(async () => {
      const reimbursement = txType === "expense" && isReimbursement;
      await api.createTransaction({
        type: txType,
        amount: value,
        wallet_id: fromWallet,
        category_id: categoryId || null,
        merchant: note.trim() || null,
        transaction_at: at,
        is_reimbursement: reimbursement,
        reimbursement_status: reimbursement ? "receivable" : "none",
        status: "approved",
      });
      return txType === "income" ? "Pemasukan tercatat." : "Pengeluaran tercatat.";
    }, "Transaksi gagal disimpan");
  }

  const scanning = busy && Boolean(scanLabel);
  const submitLabel = mode === "text" ? "Simpan ke Kotak Masuk" : mode === "transfer" ? "Catat transfer" : "Simpan transaksi";
  const submitDisabled = mode === "text" ? !text.trim() : !amount;
  const manualCategories = categories.filter((category) => category.type === txType);

  return (
    <AppDialog open={open} onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}>
      <AppDialogContent size="md" showCloseButton={false}>
        <div className="shrink-0 px-5 pb-3 pt-1">
          <AppDialogTitle className="font-display text-2xl font-semibold">Catat</AppDialogTitle>
          <AppDialogDescription className="sr-only">Catat transaksi lewat foto, teks, transfer, atau form manual.</AppDialogDescription>

          <div role="tablist" aria-label="Cara mencatat" className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-paper-sunk p-1">
            {MODES.map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={busy}
                  onClick={() => switchMode(id)}
                  className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors ${
                    active ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {active ? (
                    <motion.span layoutId="capture-mode-pill" transition={spring.snap} className="absolute inset-0 rounded-xl bg-card shadow-sm" />
                  ) : null}
                  <Icon className="relative size-[1.125rem]" aria-hidden="true" />
                  <span className="relative">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => handleFile(event, "foto struk")} />
        <input ref={galleryRef} type="file" accept="image/*,application/pdf" hidden onChange={(event) => handleFile(event, "berkas")} />

        <form id={formId} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <AppDialogBody className="space-y-3 pt-1">
            {error ? (
              <p role="alert" className="rounded-xl border border-negative-line bg-negative-soft px-3 py-2 text-sm font-medium text-negative">
                {error}
              </p>
            ) : null}

            {mode === "photo" ? (
              scanning ? (
                <ReceiptScan label={scanLabel} />
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => cameraRef.current?.click()}
                    className="flex w-full -rotate-1 items-center gap-4 rounded-3xl bg-mint p-5 text-left text-mint-ink transition-transform active:scale-[0.98]"
                  >
                    <Camera className="size-9 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    <span>
                      <span className="block text-lg font-bold leading-tight">Foto struk</span>
                      <span className="block text-sm opacity-80">Buka kamera, nominal dan merchant dibaca otomatis</span>
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => galleryRef.current?.click()}
                      className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-sm font-semibold text-ink active:bg-paper-sunk"
                    >
                      <Images className="size-5" aria-hidden="true" />
                      Galeri / PDF
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePaste()}
                      className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-sm font-semibold text-ink active:bg-paper-sunk"
                    >
                      <ClipboardPaste className="size-5" aria-hidden="true" />
                      Tempel
                    </button>
                  </div>
                  <ReimbursementSwitch checked={isReimbursement} onChange={setIsReimbursement} disabled={busy} />
                </>
              )
            ) : null}

            {mode === "text" ? (
              <>
                <label htmlFor={`${formId}-text`} className="sr-only">
                  Teks transaksi
                </label>
                <textarea
                  id={`${formId}-text`}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={busy}
                  rows={3}
                  placeholder="Contoh: kopi kawa 28rb gopay"
                  className="w-full resize-none rounded-2xl border border-line-strong bg-card p-3.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-ink"
                />
                <ReimbursementSwitch checked={isReimbursement} onChange={setIsReimbursement} disabled={busy} />
              </>
            ) : null}

            {mode === "transfer" ? (
              <>
                <FormField label="Nominal">
                  <MoneyField value={amount} onValueChange={setAmount} disabled={busy} placeholder="0" />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Dari">
                    <NativeSelectField value={fromWallet} onChange={(event) => setWalletId(event.target.value)} disabled={busy}>
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                      ))}
                    </NativeSelectField>
                  </FormField>
                  <FormField label="Ke">
                    <NativeSelectField value={destWallet} onChange={(event) => setToWalletId(event.target.value)} disabled={busy}>
                      {wallets.filter((wallet) => wallet.id !== fromWallet).map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                      ))}
                    </NativeSelectField>
                  </FormField>
                </div>
                {wallets.length < 2 ? <p className="text-xs text-caution">Transfer butuh minimal dua dompet.</p> : null}
                <FormField label="Catatan (opsional)">
                  <TextField value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} placeholder="Top up GoPay dari BCA" />
                </FormField>
              </>
            ) : null}

            {mode === "manual" ? (
              <>
                <div role="radiogroup" aria-label="Jenis transaksi" className="grid grid-cols-2 gap-1 rounded-2xl bg-paper-sunk p-1">
                  {(["expense", "income"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={txType === type}
                      disabled={busy}
                      onClick={() => {
                        setTxType(type);
                        setCategoryId("");
                      }}
                      className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                        txType === type ? (type === "expense" ? "bg-card text-negative shadow-sm" : "bg-card text-positive shadow-sm") : "text-ink-soft"
                      }`}
                    >
                      {type === "expense" ? "Pengeluaran" : "Pemasukan"}
                    </button>
                  ))}
                </div>
                <FormField label="Nominal">
                  <MoneyField value={amount} onValueChange={setAmount} disabled={busy} placeholder="0" />
                </FormField>
                <FormField label="Untuk apa">
                  <TextField value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} placeholder="Makan siang, bensin, gaji…" />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Dompet">
                    <NativeSelectField value={fromWallet} onChange={(event) => setWalletId(event.target.value)} disabled={busy}>
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                      ))}
                    </NativeSelectField>
                  </FormField>
                  <FormField label="Kategori">
                    <NativeSelectField value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={busy}>
                      <option value="">Tanpa kategori</option>
                      {manualCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </NativeSelectField>
                  </FormField>
                </div>
                <FormField label="Tanggal">
                  <DateField value={date} onChange={(event) => setDate(event.target.value)} disabled={busy} />
                </FormField>
                {txType === "expense" ? <ReimbursementSwitch checked={isReimbursement} onChange={setIsReimbursement} disabled={busy} /> : null}
              </>
            ) : null}
          </AppDialogBody>

          {mode !== "photo" ? (
            <AppDialogFooter>
              <SubmitAction form={formId} isSubmitting={busy} disabled={submitDisabled} label={submitLabel} busyLabel="Menyimpan…" className="h-12 w-full rounded-2xl text-base sm:w-auto" />
            </AppDialogFooter>
          ) : null}
        </form>
      </AppDialogContent>
    </AppDialog>
  );
}
