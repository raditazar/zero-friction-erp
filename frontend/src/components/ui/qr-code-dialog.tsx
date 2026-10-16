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
  title?: string;
  description?: string;
}

export function QRCodeDialog({
  open,
  onOpenChange,
  value,
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
    const success = await copyToClipboard(value);
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
      <AppDialogContent className="max-w-md w-full bg-white border border-[#E8E6E1] rounded-2xl shadow-xl overflow-hidden p-0">
        <AppDialogHeader className="p-5 sm:p-6 border-b border-[#E8E6E1] bg-[#FAF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-white border border-[#E8E6E1] text-[#1A1A1A]">
              <QrCodeIcon className="size-5" />
            </div>
            <div>
              <AppDialogTitle className="text-base font-bold text-[#1A1A1A]">
                {title}
              </AppDialogTitle>
              <AppDialogDescription className="text-xs text-[#706A63] mt-0.5">
                {description}
              </AppDialogDescription>
            </div>
          </div>
        </AppDialogHeader>

        <AppDialogBody className="p-6 flex flex-col items-center justify-center text-center">
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 shadow-sm flex items-center justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR Code Tautan iOS Shortcut"
                className="w-56 h-56 rounded-lg select-none"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-[#706A63] animate-pulse">
                Menyiapkan QR Code...
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#706A63] bg-[#FAF9F5] px-3.5 py-2 rounded-lg border border-[#E8E6E1]">
            <Smartphone className="size-4 text-[#0071E3] shrink-0" />
            <span>Buka Kamera bawaan iPhone, arahkan ke QR, lalu ketuk banner kuning.</span>
          </div>
        </AppDialogBody>

        <AppDialogFooter className="p-4 sm:p-5 border-t border-[#E8E6E1] bg-[#FAF9F5] flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold text-[#706A63] hover:text-[#1A1A1A]"
          >
            Tutup
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 text-xs font-bold border-[#E0DDD6] bg-white hover:bg-[#F0EEE9] text-[#1A1A1A]"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-[#047857]" /> Tersalin
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
