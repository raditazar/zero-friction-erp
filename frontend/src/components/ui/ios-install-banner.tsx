"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Share, PlusSquare, X, Sparkles } from "lucide-react";

const DISMISSED_KEY = "zfe_pwa_banner_dismissed";

export function IosInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if dismissed previously
    if (localStorage.getItem(DISMISSED_KEY) === "true") {
      return;
    }

    // Check if running on iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);

    // Check if already in standalone mode (installed as PWA)
    const isStandalone =
      ("standalone" in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone)) ||
      window.matchMedia("(display-mode: standalone)").matches;

    // Only show on iOS when running in browser (not standalone)
    if (isIos && !isStandalone) {
      setTimeout(() => {
        setShow(true);
      }, 0);
    }
  }, []);

  function handleDismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // ignore storage errors
    }
  }

  if (!show) return null;

  return (
    <div className="relative mx-3 mb-4 rounded-xl surface-raised p-3.5 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-paper border border-line text-ink">
            <Sparkles className="size-4 text-positive" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink leading-tight">
              Jadikan Aplikasi Layar Utama
            </h4>
            <p className="text-xs text-ink-soft mt-0.5 leading-snug">
              Akses kilat, layar penuh tanpa bilah Safari &amp; shortcut kamera.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex size-11 md:size-7 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-paper-sunk hover:text-ink transition-colors"
          aria-label="Tutup banner panduan"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-around gap-2 rounded-lg bg-paper border border-line px-3 py-2 text-xs font-medium text-ink">
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded bg-card border border-line-strong text-xs font-bold">1</span>
          <span>Ketuk Bagikan</span>
          <Share className="size-3.5 text-info" />
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded bg-card border border-line-strong text-xs font-bold">2</span>
          <span>Tambah ke Layar Utama</span>
          <PlusSquare className="size-3.5 text-ink" />
        </div>
      </div>
    </div>
  );
}
