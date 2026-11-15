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
    // Android resizes the layout instead of reporting an inset, so also track text focus on touch
    // devices: the dock hides whenever typing is in progress.
    const coarse = window.matchMedia("(pointer: coarse)");
    const isTextEntry = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "TEXTAREA" || el.isContentEditable ||
        (el.tagName === "INPUT" && !["checkbox", "radio", "range", "file", "button", "submit", "color"].includes((el as HTMLInputElement).type)));
    const onFocusIn = (event: FocusEvent) => root.toggleAttribute("data-typing", coarse.matches && isTextEntry(event.target));
    const onFocusOut = () => root.removeAttribute("data-typing");
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
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
