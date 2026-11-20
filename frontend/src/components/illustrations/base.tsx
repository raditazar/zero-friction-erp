"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * House illustration style: ink line art (currentColor) with one mint accent.
 * Every colour comes from a theme token, so the drawings are correct in dark mode for free.
 * Strokes draw themselves in through pathLength; children stagger in document order.
 */
const frame: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const drawn: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.12 } },
  },
};

const filled: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 18, mass: 0.8 } },
};

export type IllustrationProps = {
  className?: string;
  /** Accessible name. Omit for decorative use next to a text label. */
  title?: string;
};

export function Illustration({
  className,
  title,
  children,
  viewBox = "0 0 160 120",
}: IllustrationProps & { children: ReactNode; viewBox?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("h-28 w-auto text-ink", className)}
      variants={frame}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {children}
    </motion.svg>
  );
}

/** Ink stroke that draws itself in. */
export function Ink({ d, width, faint }: { d: string; width?: number; faint?: boolean }) {
  return <motion.path d={d} variants={drawn} strokeWidth={width} opacity={faint ? 0.45 : undefined} />;
}

/** Stroke in the mint accent. */
export function MintLine({ d, width = 3 }: { d: string; width?: number }) {
  return <motion.path d={d} variants={drawn} stroke="var(--mint)" strokeWidth={width} />;
}

/** Mint patch that pops in. `origin` is the pop centre in viewBox units. */
export function Mint({ d, origin, opacity = 1 }: { d: string; origin: [number, number]; opacity?: number }) {
  return (
    <motion.path
      d={d}
      variants={filled}
      fill="var(--mint)"
      fillOpacity={opacity}
      stroke="none"
      style={{ transformOrigin: `${origin[0]}px ${origin[1]}px`, transformBox: "view-box" }}
    />
  );
}

/** Detail drawn on top of a mint patch; stays dark in both themes. */
export function OnMint({ d, width = 2.5 }: { d: string; width?: number }) {
  return <motion.path d={d} variants={drawn} stroke="var(--mint-ink)" strokeWidth={width} />;
}

/** Full circle as a path so it can draw in like any other stroke. */
export function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}
