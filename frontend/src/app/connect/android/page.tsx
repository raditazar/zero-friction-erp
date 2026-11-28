"use client";

import { Download, ExternalLink } from "lucide-react";
import { PLAY_STORE_MACRODROID_URL } from "@/components/dashboard/AndroidGuideCard";
import { downloadMacroDroidTemplate } from "@/lib/macrodroid-template";
import { ConnectPage, ConnectStep, CopyUrl, IncompleteLink, useEndpointFromHash } from "../connect-parts";

/**
 * Opened by the QR on the Android card. The .macro file is built here on the phone from the
 * webhook URL, so it lands where MacroDroid can import it.
 */
export default function ConnectAndroidPage() {
  const webhookUrl = useEndpointFromHash("/integrations/android/notifications");
  return (
    <ConnectPage title="Hubungkan Android" subtitle="MacroDroid meneruskan notifikasi pembayaran ke Satset.">
      {webhookUrl ? (
        <ol className="grid gap-4">
          <ConnectStep title="1. Pasang MacroDroid">
            <a href={PLAY_STORE_MACRODROID_URL} className="btn-secondary flex items-center justify-center gap-2">
              Buka Play Store
              <ExternalLink className="size-3.5 opacity-80" aria-hidden="true" />
            </a>
          </ConnectStep>
          <ConnectStep title="2. Unduh template">
            <p className="text-xs text-ink-soft">Tautan webhook Anda sudah ada di dalamnya. Buka file .macro dengan MacroDroid untuk mengimpor.</p>
            <button type="button" onClick={() => downloadMacroDroidTemplate(webhookUrl)} className="btn-primary flex items-center justify-center gap-2">
              <Download className="size-4" aria-hidden="true" />
              Unduh template .macro
            </button>
          </ConnectStep>
          <ConnectStep title="Atau atur sendiri">
            <CopyUrl url={webhookUrl} />
          </ConnectStep>
        </ol>
      ) : (
        <IncompleteLink step="buat tautan webhook Android" />
      )}
    </ConnectPage>
  );
}
