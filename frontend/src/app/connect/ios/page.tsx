"use client";

import { Download, ExternalLink } from "lucide-react";
import { IOS_SHORTCUT_INSTALL_URL } from "@/components/dashboard/iOSShortcutGuideCard";
import { ConnectPage, ConnectStep, CopyUrl, IncompleteLink, useEndpointFromHash } from "../connect-parts";

/** Opened by the QR on the iOS Shortcut card: copy the capture URL, then install the shortcut. */
export default function ConnectIOSPage() {
  const captureUrl = useEndpointFromHash("/ai/extract-transaction");
  return (
    <ConnectPage title="Hubungkan iPhone" subtitle="Pintasan untuk mengirim foto struk ke Satset.">
      {captureUrl ? (
        <ol className="grid gap-4">
          <ConnectStep title="1. Salin tautan pintasan">
            <CopyUrl url={captureUrl} />
          </ConnectStep>
          <ConnectStep title="2. Pasang pintasan">
            <p className="text-xs text-ink-soft">Saat aplikasi Pintasan meminta URL, tempel tautan dari langkah 1.</p>
            <a href={IOS_SHORTCUT_INSTALL_URL} className="btn-primary flex items-center justify-center gap-2">
              <Download className="size-4" aria-hidden="true" />
              Pasang pintasan
              <ExternalLink className="size-3.5 opacity-80" aria-hidden="true" />
            </a>
          </ConnectStep>
        </ol>
      ) : (
        <IncompleteLink step="buat tautan pintasan di Langkah 1" />
      )}
    </ConnectPage>
  );
}
