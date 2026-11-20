"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { readThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "system", label: "Sistem", icon: Monitor },
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(readThemePreference());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ pref: ThemePreference }>).detail;
      if (detail?.pref) setPref(detail.pref);
    };
    window.addEventListener("zfe-theme-change", onChange);
    return () => window.removeEventListener("zfe-theme-change", onChange);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className={`inline-flex rounded-full border border-line bg-paper-sunk p-1 ${className}`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              haptics.tap();
              setPref(value);
              setThemePreference(value);
            }}
            className={`relative flex items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
              active ? "text-primary-foreground" : "text-ink-soft"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="theme-toggle-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={spring.snap}
              />
            ) : null}
            <Icon className="relative size-4" aria-hidden="true" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
