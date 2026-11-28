"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, ExternalLink, Smartphone } from "lucide-react";
import { copyToClipboard, IOS_SHORTCUT_INSTALL_URL } from "@/components/dashboard/iOSShortcutGuideCard";

/**
 * Landing page for the QR code on the iOS Shortcut card. The phone's camera can only open a URL,
 * so the QR points here instead of at the POST-only capture endpoint (opening that in Safari is a
 * GET and fails with 401). The capture URL rides in the fragment, which browsers never send to a
 * server, so the token stays out of request logs. No login needed: the page only reads the hash.
 */

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The capture URL from `#u=…`, or "" when it is missing or not a capture URL. */
function captureUrlFromHash() {
  const raw = new URLSearchParams(window.location.hash.slice(1)).get("u") ?? "";
  try {
    const url = new URL(raw);
    const ok = url.protocol === "https:" || url.hostname === "localhost";
    return ok && url.pathname.endsWith("/ai/extract-transaction") && url.searchParams.get("token") ? url.toString() : "";
  } catch {
    return "";
  }
}

export default function ConnectIOSPage() {
  const captureUrl = useSyncExternalStore(subscribe, captureUrlFromHash, () => "");
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyToClipboard(captureUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl surface-raised text-ink">
          <Smartphone className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-ink">Hubungkan iPhone</h1>
          <p className="text-xs text-ink-soft">Pintasan untuk mengirim foto struk ke Satset.</p>
        </div>
      </header>

      {captureUrl ? (
        <ol className="grid gap-4">
          <li className="grid gap-3 rounded-2xl surface-raised p-4">
            <p className="text-sm font-semibold text-ink">1. Salin tautan pintasan</p>
            <code className="surface-inset block break-all rounded-lg px-3 py-2.5 font-mono text-xs text-ink">{captureUrl}</code>
            <button type="button" onClick={() => void copy()} className="btn-secondary flex items-center justify-center gap-2">
              {copied ? <Check className="size-4 text-positive" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? "Tersalin" : "Salin tautan"}
            </button>
            <p className="text-xs text-ink-soft">Tautan ini berisi kunci akun Anda. Jangan bagikan ke orang lain.</p>
          </li>
          <li className="grid gap-3 rounded-2xl surface-raised p-4">
            <p className="text-sm font-semibold text-ink">2. Pasang pintasan</p>
            <p className="text-xs text-ink-soft">Saat aplikasi Pintasan meminta URL, tempel tautan dari langkah 1.</p>
            <a href={IOS_SHORTCUT_INSTALL_URL} className="btn-primary flex items-center justify-center gap-2">
              <Download className="size-4" aria-hidden="true" />
              Pasang pintasan
              <ExternalLink className="size-3.5 opacity-80" aria-hidden="true" />
            </a>
          </li>
        </ol>
      ) : (
        <p className="rounded-2xl surface-raised p-4 text-sm text-ink-soft">
          Tautan ini tidak lengkap. Buka Pengaturan di Satset dari komputer, buat tautan pintasan di Langkah 1, lalu pindai ulang kode QR-nya.
        </p>
      )}
    </main>
  );
}
