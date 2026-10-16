"use client";

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Sparkles,
  ArrowLeftRight,
  Clipboard,
  Image as ImageIcon,
  X,
  Loader2,
  Check,
  Send,
  Building2,
} from "lucide-react";
import { api, type Wallet } from "@/lib/api";
import { toast } from "@/components/ui/toast";

interface QuickCaptureDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onOpenDetailedForm?: () => void;
}

export function QuickCaptureDrawer({
  open,
  onOpenChange,
  onSuccess,
  onOpenDetailedForm,
}: QuickCaptureDrawerProps) {
  const [mode, setMode] = useState<"ai" | "transfer">("ai");
  const [aiText, setAiText] = useState("");
  const [isReimbursement, setIsReimbursement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Transfer states
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function triggerHaptic(duration = 15) {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(duration);
      }
    } catch {
      // ignore
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setAiText("");
      setIsReimbursement(false);
      setTransferAmount("");
      setTransferNote("");
      setStatusMessage("");
    }
    onOpenChange(nextOpen);
  }

  // Load wallets when transfer mode or drawer is opened
  useEffect(() => {
    if (!open) return;

    api.wallets()
      .then((data) => {
        setWallets(data);
        if (data.length >= 2) {
          setFromWalletId((current) => current || data[0].id);
          setToWalletId((current) => current || data[1].id);
        } else if (data.length === 1) {
          setFromWalletId((current) => current || data[0].id);
        }
      })
      .catch(console.error);

    // Focus textarea when in AI mode
    const timer = setTimeout(() => {
      if (mode === "ai") {
        textareaRef.current?.focus();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [open, mode]);

  // Handle AI Text Submit
  async function handleAISubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    const cleanText = aiText.trim();
    if (!cleanText || busy) return;

    setBusy(true);
    setStatusMessage("Menganalisis teks via Gemini AI…");

    try {
      const textToExtract = isReimbursement
        ? `${cleanText} (reimbursement kantor)`
        : cleanText;

      const res = await api.extractTransaction(textToExtract);

      // If user toggled reimbursement, ensure it is saved
      if (isReimbursement && res.transaction?.id) {
        await api.markReimbursement(res.transaction.id).catch(() => {});
      }

      triggerHaptic(25);
      const merchant = res.transaction?.merchant || "Transaksi";
      toast.success(`Berhasil dicatat ke Staging Inbox: ${merchant}`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengekstrak transaksi.";
      setStatusMessage(msg);
      toast.error("Ekstraksi gagal", { detail: msg });
    } finally {
      setBusy(false);
    }
  }

  // Handle Image Extraction (from file picker or clipboard)
  async function extractImageFile(file: File | Blob, sourceName = "struk") {
    setBusy(true);
    setStatusMessage(`Menganalisis ${sourceName} via Gemini Multimodal…`);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          const mimeType = file.type || "image/jpeg";

          const res = await api.extractTransaction({
            image_base64: base64Data,
            image_mime: mimeType,
          });

          if (isReimbursement && res.transaction?.id) {
            await api.markReimbursement(res.transaction.id).catch(() => {});
          }

          triggerHaptic(25);
          const merchant = res.transaction?.merchant || "Struk Pembayaran";
          toast.success(`Berhasil diekstrak dari ${sourceName}: ${merchant}`);
          onOpenChange(false);
          if (onSuccess) onSuccess();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Gagal memproses gambar struk.";
          setStatusMessage(msg);
          toast.error("Gagal memproses gambar", { detail: msg });
        } finally {
          setBusy(false);
        }
      };

      reader.onerror = () => {
        toast.error("Gagal membaca berkas gambar.");
        setBusy(false);
      };

      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membaca berkas.";
      toast.error(msg);
      setBusy(false);
    }
  }

  // Handle Clipboard Paste (Text or Screenshot Image)
  async function handlePasteFromClipboard() {
    triggerHaptic(15);
    setStatusMessage("Membaca papan klip (clipboard)…");

    try {
      // 1. Try reading rich clipboard (for screenshot image blobs)
      if (navigator.clipboard && typeof navigator.clipboard.read === "function") {
        try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
            const imageType = item.types.find((t) => t.startsWith("image/"));
            if (imageType) {
              const blob = await item.getType(imageType);
              toast.info("Screenshot terdeteksi di clipboard, mengekstrak…");
              await extractImageFile(blob, "screenshot clipboard");
              return;
            }
          }
        } catch (clipboardReadErr) {
          // If reading items is restricted, fall back to readText
          console.debug("Clipboard items read not permitted, falling back to text:", clipboardReadErr);
        }
      }

      // 2. Fall back to reading plain text
      if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setAiText(text.trim());
          toast.success("Teks berhasil ditempel dari clipboard.");
          textareaRef.current?.focus();
          return;
        }
      }

      toast.info("Tidak ada gambar atau teks baru di clipboard.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Papan klip tidak dapat diakses.";
      toast.error("Gagal membaca clipboard", { detail: msg });
    } finally {
      setStatusMessage("");
    }
  }

  // Handle File Picker (Gallery / Invoice PDF)
  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void extractImageFile(file, "berkas invoice/struk");
    }
    if (e.target) {
      e.target.value = "";
    }
  }

  // Handle Transfer Submit
  async function handleTransferSubmit(e: FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(transferAmount.replace(/[^0-9.]/g, ""));
    if (!amountNum || amountNum <= 0) {
      toast.error("Masukkan nominal transfer yang valid.");
      return;
    }
    if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) {
      toast.error("Pilih dompet asal dan dompet tujuan yang berbeda.");
      return;
    }

    setBusy(true);
    try {
      await api.createTransfer({
        wallet_id: fromWalletId,
        destination_wallet_id: toWalletId,
        amount: amountNum,
        transaction_at: new Date().toISOString(),
        note: transferNote.trim() || "Transfer antar-dompet",
        status: "approved",
      });

      triggerHaptic(30);
      toast.success("Transfer saldo antar-dompet berhasil dicatat!");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mencatat transfer.";
      toast.error("Gagal transfer", { detail: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        {/* Backdrop Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1A1A1A]/40 backdrop-blur-xs animate-in fade-in duration-200" />

        {/* Drawer Content positioned at bottom on mobile */}
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border-t border-[#E0DDD6] bg-[#FFFFFF] p-4 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 focus:outline-none pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))]">
          {/* Grab Handle */}
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#D8D5CE]" />

          {/* Drawer Header & Mode Switcher */}
          <div className="flex items-center justify-between pb-3">
            {/* Segmented Control */}
            <div className="flex items-center rounded-lg bg-[#FAF9F5] border border-[#E8E6E1] p-1 text-xs font-bold text-[#706A63]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setMode("ai");
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
                  mode === "ai"
                    ? "bg-[#1A1A1A] text-white shadow-xs"
                    : "hover:text-[#1A1A1A]"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>Catat AI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setMode("transfer");
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
                  mode === "transfer"
                    ? "bg-[#1A1A1A] text-white shadow-xs"
                    : "hover:text-[#1A1A1A]"
                }`}
              >
                <ArrowLeftRight className="size-3.5" />
                <span>Transfer</span>
              </button>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full text-[#706A63] hover:bg-[#F4F3EE] hover:text-[#1A1A1A] transition-colors"
                aria-label="Tutup pencatatan kilat"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Hidden File Picker for Gallery & Documents */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileSelected}
            aria-hidden="true"
          />

          {/* TAB 1: CATAT TRANSAKSI / AI */}
          {mode === "ai" ? (
            <form onSubmit={handleAISubmit} className="space-y-3.5 pt-1">
              <div>
                <label htmlFor="quick-ai-input" className="sr-only">
                  Teks transaksi bebas
                </label>
                <textarea
                  id="quick-ai-input"
                  ref={textareaRef}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="Ketik: 'Kopi Kawa 28k bca' atau 'Makan siang 35rb cash'…"
                  disabled={busy}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[#D8D5CE] bg-[#FAF9F5] p-3 text-sm text-[#1A1A1A] placeholder-[#948E85] focus:border-[#1A1A1A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A1A] transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAISubmit();
                    }
                  }}
                />
              </div>

              {/* Action Buttons: Paste Clipboard & Gallery Picker */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handlePasteFromClipboard()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#3D3935] hover:bg-[#F4F3EE] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Clipboard className="size-3.5 text-[#0071E3]" />
                  <span>Tempel Bukti (Paste SS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    fileInputRef.current?.click();
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#3D3935] hover:bg-[#F4F3EE] active:scale-95 transition-all disabled:opacity-50"
                >
                  <ImageIcon className="size-3.5 text-[#047857]" />
                  <span>Galeri / Invoice</span>
                </button>
              </div>

              {/* Reimbursement Switch */}
              <div className="flex items-center justify-between rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] px-3 py-2">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-[#EA580C]" />
                  <div>
                    <span className="text-xs font-bold text-[#1A1A1A]">Klaim Kantor (Reimbursement)</span>
                    <p className="text-[11px] text-[#706A63]">Tandai transaksi ini sebagai piutang kantor</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isReimbursement}
                    onChange={(e) => setIsReimbursement(e.target.checked)}
                    disabled={busy}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#D8D5CE] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#EA580C]" />
                </label>
              </div>

              {statusMessage && (
                <p className="text-xs text-[#706A63] italic animate-pulse">
                  {statusMessage}
                </p>
              )}

              {/* Submit & Secondary Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    if (onOpenDetailedForm) {
                      onOpenDetailedForm();
                    } else if (typeof window !== "undefined") {
                      window.location.href = "/transactions?action=new";
                    }
                  }}
                  className="text-xs font-semibold text-[#706A63] hover:text-[#1A1A1A] underline underline-offset-2 transition-colors"
                >
                  Form Detail Manual
                </button>

                <button
                  type="submit"
                  disabled={!aiText.trim() || busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#2E2C29] active:scale-95 transition-all disabled:opacity-40"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Memproses…</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      <span>Simpan ke Inbox</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: TRANSFER ANTAR-DOMPET */
            <form onSubmit={handleTransferSubmit} className="space-y-3.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#706A63] mb-1">
                    Dompet Asal
                  </label>
                  <select
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-[#D8D5CE] bg-[#FAF9F5] p-2 text-xs font-medium text-[#1A1A1A] focus:border-[#1A1A1A] focus:bg-white focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === toWalletId}>
                        {w.name} ({w.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#706A63] mb-1">
                    Dompet Tujuan
                  </label>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-[#D8D5CE] bg-[#FAF9F5] p-2 text-xs font-medium text-[#1A1A1A] focus:border-[#1A1A1A] focus:bg-white focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id} disabled={w.id === fromWalletId}>
                        {w.name} ({w.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#706A63] mb-1">
                  Nominal Transfer (Rp)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="Contoh: 100000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-lg border border-[#D8D5CE] bg-[#FAF9F5] p-2 text-sm font-semibold text-[#1A1A1A] focus:border-[#1A1A1A] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#706A63] mb-1">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Top up GoPay dari BCA"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-lg border border-[#D8D5CE] bg-[#FAF9F5] p-2 text-xs text-[#1A1A1A] focus:border-[#1A1A1A] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={!transferAmount || busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#2E2C29] active:scale-95 transition-all disabled:opacity-40"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Memproses…</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      <span>Transfer Saldo Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
