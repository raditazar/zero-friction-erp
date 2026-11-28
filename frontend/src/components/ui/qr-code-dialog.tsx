"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AppDialog, AppDialogContent, AppDialogHeader, AppDialogTitle, AppDialogDescription, AppDialogBody, AppDialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, QrCode as QrCodeIcon, Smartphone } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { copyToClipboard } from "@/components/dashboard/iOSShortcutGuideCard";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  /** What "Salin URL Tautan" copies, when it differs from what the QR encodes. */
  copyValue?: string;
  title?: string;
  description?: string;
  /** One-line how-to under the code. */
  hint?: string;
}

export function QRCodeDialog({
  open,
  onOpenChange,
  value,
  copyValue,
  hint = "Buka Kamera bawaan iPhone, arahkan ke QR, lalu ketuk banner kuning.",
  title = "Pindai QR Code di iPhone",
  description = "Arahkan kamera iPhone Anda ke kode QR ini untuk menyalin tautan konfigurasi otomatis.",
}: QRCodeDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!value || !open) return;

    QRCode.toDataURL(value, {
      width: 280,
      margin: 2,
      color: {
        dark: "#1A1A1A",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error("Gagal membuat QR Code:", err));
  }, [value, open]);

  async function handleCopy() {
    const success = await copyToClipboard(copyValue ?? value);
    if (success) {
      setCopied(true);
      toast.success("Tautan konfigurasi berhasil disalin!");
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Gagal menyalin tautan.");
    }
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent className="max-w-md w-full surface-raised rounded-2xl shadow-xl overflow-hidden p-0">
        <AppDialogHeader className="p-5 sm:p-6 border-b border-line bg-paper">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl surface-raised text-ink">
              <QrCodeIcon className="size-5" />
            </div>
            <div>
              <AppDialogTitle className="text-base font-bold text-ink">
                {title}
              </AppDialogTitle>
              <AppDialogDescription className="text-xs text-ink-soft mt-0.5">
                {description}
              </AppDialogDescription>
            </div>
          </div>
        </AppDialogHeader>

        <AppDialogBody className="p-6 flex flex-col items-center justify-center text-center">
          <div className="rounded-2xl surface-raised p-4 flex items-center justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Kode QR"
                className="w-56 h-56 rounded-lg select-none"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-ink-soft animate-pulse">
                Menyiapkan QR Code...
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-ink-soft bg-paper px-3.5 py-2 rounded-lg border border-line">
            <Smartphone className="size-4 text-info shrink-0" />
            <span>{hint}</span>
          </div>
        </AppDialogBody>

        <AppDialogFooter className="p-4 sm:p-5 border-t border-line bg-paper flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold text-ink-soft hover:text-ink"
          >
            Tutup
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 text-xs font-bold border-line bg-card hover:bg-paper-sunk text-ink"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-positive" /> Tersalin
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Salin URL Tautan
              </>
            )}
          </Button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
