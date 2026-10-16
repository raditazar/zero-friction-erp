"use client";

import { useEffect, useState } from "react";
import { Share, PlusSquare, X, Sparkles } from "lucide-react";

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
    <div className="relative mx-3 mb-4 rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] p-3.5 shadow-xs md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#FAF9F5] border border-[#E8E6E1] text-[#1A1A1A]">
            <Sparkles className="size-4 text-[#047857]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#1A1A1A] leading-tight">
              Jadikan Aplikasi Layar Utama
            </h4>
            <p className="text-[11px] text-[#706A63] mt-0.5 leading-snug">
              Akses kilat, layar penuh tanpa bilah Safari &amp; shortcut kamera.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#706A63] hover:bg-[#F0EEE9] hover:text-[#1A1A1A] transition-colors"
          aria-label="Tutup banner panduan"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-around gap-2 rounded-lg bg-[#FAF9F5] border border-[#E8E6E1] px-3 py-2 text-[11px] font-medium text-[#3D3935]">
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded bg-white border border-[#D8D5CE] text-[10px] font-bold">1</span>
          <span>Ketuk Bagikan</span>
          <Share className="size-3.5 text-[#0071E3]" />
        </div>
        <span className="text-[#C5C0B6]">→</span>
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded bg-white border border-[#D8D5CE] text-[10px] font-bold">2</span>
          <span>Tambah ke Layar Utama</span>
          <PlusSquare className="size-3.5 text-[#1A1A1A]" />
        </div>
      </div>
    </div>
  );
}
