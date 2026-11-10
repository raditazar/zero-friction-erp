"use client";

import { useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { Camera, Inbox, Sparkles } from "lucide-react";

interface MobileFloatingBarProps {
  onCameraCapture?: (file: File) => void;
  onQuickAddClick?: () => void;
  pendingCount?: number;
  className?: string;
}

export function MobileFloatingBar({
  onCameraCapture,
  onQuickAddClick,
  pendingCount = 0,
  className = "",
}: MobileFloatingBarProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function triggerHaptic(duration = 15) {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(duration);
      }
    } catch {
      // ignore devices without vibration support
    }
  }

  function handleCameraClick() {
    triggerHaptic(15);
    cameraInputRef.current?.click();
  }

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onCameraCapture) {
      onCameraCapture(file);
    }
    // reset input value so re-taking the same photo triggers change
    if (e.target) {
      e.target.value = "";
    }
  }

  function handleQuickAdd() {
    triggerHaptic(15);
    if (onQuickAddClick) {
      onQuickAddClick();
    }
  }

  return (
    <nav
      aria-label="Aksi Cepat Mobile"
      className={`fixed left-1/2 -translate-x-1/2 bottom-[calc(0.875rem+env(safe-area-inset-bottom,12px))] z-40 md:hidden flex items-center gap-1.5 rounded-full border border-line bg-card/95 p-1.5 shadow-lg backdrop-blur-md transition-all ${className}`}
    >
      {/* Hidden native camera capture input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
        aria-hidden="true"
      />

      {/* Button 1: Camera Struk */}
      <button
        type="button"
        onClick={handleCameraClick}
        aria-label="Jepret foto struk dengan kamera"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-paper active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <Camera className="size-5" />
      </button>

      {/* Button 2: Catat Cepat (Primary Center Pill) */}
      <button
        type="button"
        onClick={handleQuickAdd}
        className="flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <Sparkles className="size-3.5 text-mint" />
        <span>Catat Cepat</span>
      </button>

      {/* Button 3: Staging Inbox with Pending Counter */}
      <Link
        href="/inbox"
        onClick={() => triggerHaptic(10)}
        aria-label={`Buka Staging Inbox ${pendingCount > 0 ? `(${pendingCount} belum diverifikasi)` : ""}`}
        className="relative flex size-11 items-center justify-center rounded-full text-ink hover:bg-paper active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <Inbox className="size-5" />
        {pendingCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-size-4 items-center justify-center rounded-full bg-caution-solid px-1 text-xs font-black text-white ring-2 ring-card">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </Link>
    </nav>
  );
}
