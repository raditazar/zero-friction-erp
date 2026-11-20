"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorIllustration, OfflineIllustration } from "@/components/illustrations";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  message: string;
  technicalDetails?: string;
  onRetry?: () => void;
  /** Smaller drawing and padding, for use above content that is still usable. */
  compact?: boolean;
  className?: string;
}

function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function ErrorState({ title, message, technicalDetails, onRetry, compact = false, className }: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);
  const online = useOnline();
  const Art = online ? ErrorIllustration : OfflineIllustration;
  const heading = online ? title ?? "Ada yang tidak beres" : "Kamu sedang luring";
  const body = online ? message : "Periksa koneksi internet, lalu coba lagi. Data terakhir tetap aman.";

  return (
    <div
      role="alert"
      className={cn(
        "flex w-full flex-col items-center rounded-2xl surface-raised text-center",
        compact ? "px-4 py-5" : "px-6 py-10",
        className,
      )}
    >
      <Art className={compact ? "h-16" : "h-28"} />
      <h3 className={cn("font-semibold tracking-tight text-ink", compact ? "mt-2 text-base" : "mt-5 text-lg")}>{heading}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{body}</p>

      {onRetry ? (
        <Button onClick={onRetry} className="mt-5 h-11 gap-2 rounded-xl px-5 text-sm font-semibold">
          <RefreshCw className="size-4" aria-hidden="true" />
          Coba lagi
        </Button>
      ) : null}

      {technicalDetails ? (
        <div className="mt-3 w-full max-w-sm">
          <button
            type="button"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((open) => !open)}
            className="mx-auto flex items-center gap-1 rounded-lg px-3 text-xs font-medium text-ink-soft hover:text-ink"
          >
            Detail teknis
            <ChevronDown className={cn("size-3.5 transition-transform", showDetails && "rotate-180")} aria-hidden="true" />
          </button>
          {showDetails ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-paper p-3 text-left text-xs text-ink-soft">
              {technicalDetails}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
