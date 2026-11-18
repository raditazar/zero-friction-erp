"use client";

import { useEffect, useRef } from "react";
import type { CaptureMode } from "@/components/dashboard/CaptureSheet";

const EVENT = "zfe-open-capture";

/** Opens the shell's Catat sheet from anywhere (a page header, an empty state). */
export function openCapture(mode?: CaptureMode) {
  window.dispatchEvent(new CustomEvent<{ mode?: CaptureMode }>(EVENT, { detail: { mode } }));
}

/** Used by the dashboard shell, which owns the single Catat sheet. */
export function useCaptureRequests(handler: (mode?: CaptureMode) => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  }, [handler]);
  useEffect(() => {
    const listener = (event: Event) => latest.current((event as CustomEvent<{ mode?: CaptureMode }>).detail?.mode);
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, []);
}
