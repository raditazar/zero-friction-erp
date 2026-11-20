"use client";

import dynamic from "next/dynamic";
import { SceneHost } from "./scene-host";
import type { JarTone } from "./budget-jar-scene";

export type { JarTone } from "./budget-jar-scene";

const BudgetJarScene = dynamic(() => import("./budget-jar-scene"), { ssr: false });

const TONE_FILL: Record<JarTone, string> = {
  mint: "var(--mint)",
  caution: "var(--caution-solid)",
  negative: "var(--negative-solid)",
};

/** Flat jar for reduced motion, Save-Data and weak devices. */
function BudgetJarStatic({ level, tone }: { level: number; tone: JarTone }) {
  const top = 22;
  const bottom = 108;
  const y = bottom - (bottom - top) * Math.max(0, Math.min(1, level));
  return (
    <svg viewBox="0 0 100 120" className="h-full w-full" aria-hidden="true">
      <defs>
        <clipPath id="jar-inside">
          <path d="M22 30q0-8 8-10h40q8 2 8 10v72q0 8-8 8H30q-8 0-8-8Z" />
        </clipPath>
      </defs>
      <rect x="0" y={y} width="100" height="120" fill={TONE_FILL[tone]} opacity="0.85" clipPath="url(#jar-inside)" />
      <path d="M22 30q0-8 8-10h40q8 2 8 10v72q0 8-8 8H30q-8 0-8-8Z" fill="none" stroke="var(--line-strong)" strokeWidth="2.5" />
      <path d="M32 12h36v8H32Z" fill="var(--paper-sunk)" stroke="var(--line-strong)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Budget jar: `level` is the share of the month's budget still left (0..1).
 * Mint while healthy, caution under 20%, negative once over budget.
 */
export function BudgetJar({ level, tone, className }: { level: number; tone: JarTone; className?: string }) {
  const clamped = Math.max(0, Math.min(1, level));
  return (
    <SceneHost
      scene={BudgetJarScene}
      props={{ level: clamped, tone }}
      fallback={<BudgetJarStatic level={clamped} tone={tone} />}
      className={className}
      interactive={false}
    />
  );
}
