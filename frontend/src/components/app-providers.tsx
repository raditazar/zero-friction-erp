"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { applyTheme, readThemePreference } from "@/lib/theme";

/** Publishes the on-screen keyboard height as --kb so sheets and docks can stay above it. */
function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        // Ignore browser chrome jitter; a real keyboard is far taller than 80px.
        const keyboard = inset > 80 ? Math.round(inset) : 0;
        root.style.setProperty("--kb", `${keyboard}px`);
        root.toggleAttribute("data-keyboard-open", keyboard > 0);
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
}

/** Keeps "system" theme in step with the OS while the app is open. */
function useSystemThemeSync() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemePreference() === "system") applyTheme("system");
    };
    applyTheme(readThemePreference());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
}

export function AppProviders({ children }: { children: ReactNode }) {
  useKeyboardInset();
  useSystemThemeSync();
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
