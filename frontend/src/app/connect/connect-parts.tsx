"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { copyToClipboard } from "@/components/dashboard/iOSShortcutGuideCard";

/*
 * Pieces shared by the pages the integration QR codes open. A phone camera can only open a URL,
 * and the integration endpoints only take POST, so the QR opens one of these pages with the
 * endpoint URL in the fragment (`#u=…`). Browsers never send the fragment to a server, so the
 * token stays out of request logs. No login needed: the pages only read the hash.
 */

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The endpoint URL from `#u=…` when it is https, ends in `path` and carries a token; else "". */
export function useEndpointFromHash(path: string) {
  return useSyncExternalStore(
    subscribe,
    () => {
      const raw = new URLSearchParams(window.location.hash.slice(1)).get("u") ?? "";
      try {
        const url = new URL(raw);
        const secure = url.protocol === "https:" || url.hostname === "localhost";
        return secure && url.pathname.endsWith(path) && url.searchParams.get("token") ? url.toString() : "";
      } catch {
        return "";
      }
    },
    () => "",
  );
}

export function ConnectPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl surface-raised text-ink">
          <Smartphone className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-ink">{title}</h1>
          <p className="text-xs text-ink-soft">{subtitle}</p>
        </div>
      </header>
      {children}
    </main>
  );
}

export function ConnectStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="grid gap-3 rounded-2xl surface-raised p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children}
    </li>
  );
}

export function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (await copyToClipboard(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }
  return (
    <>
      <code className="surface-inset block break-all rounded-lg px-3 py-2.5 font-mono text-xs text-ink">{url}</code>
      <button type="button" onClick={() => void copy()} className="btn-secondary flex items-center justify-center gap-2">
        {copied ? <Check className="size-4 text-positive" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? "Tersalin" : "Salin tautan"}
      </button>
      <p className="text-xs text-ink-soft">Tautan ini berisi kunci akun Anda. Jangan bagikan ke orang lain.</p>
    </>
  );
}

export function IncompleteLink({ step }: { step: string }) {
  return (
    <p className="rounded-2xl surface-raised p-4 text-sm text-ink-soft">
      Tautan ini tidak lengkap. Buka Pengaturan di Satset dari komputer, {step}, lalu pindai ulang kode QR-nya.
    </p>
  );
}
