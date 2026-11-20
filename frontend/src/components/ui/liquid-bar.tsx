"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const TONES = {
  mint: "bg-mint text-mint",
  caution: "bg-caution-solid text-caution-solid",
  negative: "bg-negative-solid text-negative-solid",
} as const;

export type LiquidTone = keyof typeof TONES;

/**
 * Progress bar that fills like liquid: the fill pours in from empty and its leading edge
 * is a gently drifting wave. `value` is 0..100.
 */
export function LiquidBar({
  value,
  tone = "mint",
  label,
  className,
}: {
  value: number;
  tone?: LiquidTone;
  /** Accessible name, e.g. "Makan & Minum terpakai". */
  label: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("relative h-3 w-full overflow-hidden rounded-full bg-paper-sunk", className)}
    >
      <motion.div
        initial={reduced ? false : { width: "0%" }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 70, damping: 18 }}
        className={cn("relative h-full rounded-l-full", TONES[tone])}
      >
        {pct > 0 && pct < 100 ? (
          // Wavy edge: a tall wave strip that drifts vertically, clipped by the track.
          <svg
            aria-hidden="true"
            viewBox="0 0 8 48"
            preserveAspectRatio="none"
            className="liquid-edge absolute -right-[7px] top-0 h-[200%] w-2 fill-current"
          >
            <path d="M0 0h3q5 6 0 12t0 12 0 12 0 12H0Z" />
          </svg>
        ) : null}
      </motion.div>
    </div>
  );
}
