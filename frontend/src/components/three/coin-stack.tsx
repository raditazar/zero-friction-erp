"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CoinStackStatic } from "@/components/illustrations/coin-stack-static";
import { cn } from "@/lib/utils";

// three + react-three-fiber live in their own chunk, fetched only once a stack scrolls into view.
const CoinStackScene = dynamic(() => import("./coin-stack-scene"), { ssr: false });

const MIN_COINS = 3;
const MAX_COINS = 9;

/** Maps this month's cashflow direction (-1 = all outflow, 1 = all inflow) to a stack height. */
export function coinsForCashflow(income: number, expense: number) {
  const scale = Math.max(income, expense, 1);
  const direction = Math.max(-1, Math.min(1, (income - expense) / scale));
  return Math.round((MIN_COINS + MAX_COINS) / 2 + (direction * (MAX_COINS - MIN_COINS)) / 2);
}

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

let capable: boolean | undefined;

/**
 * 3D is a nicety, never a cost: skip it for reduced motion, Save-Data and weak devices.
 * localStorage "zfe-3d" = "on" | "off" overrides the heuristics for testing on a real device.
 */
function canRender3D() {
  let override: string | null = null;
  try {
    override = localStorage.getItem("zfe-3d");
  } catch {
    override = null;
  }
  if (override === "off") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (capable === undefined) {
    const nav = navigator as Nav;
    const weak = (nav.deviceMemory !== undefined && nav.deviceMemory < 4) || (nav.hardwareConcurrency ?? 8) <= 4;
    capable = webglAvailable() && (override === "on" || !(weak || nav.connection?.saveData === true));
  }
  return capable;
}

function subscribeMotion(notify: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export function CoinStack({
  count = 6,
  ready = true,
  className,
}: {
  /** Number of coins, 3 to 9. Use coinsForCashflow(). */
  count?: number;
  /** Coins drop once this turns true (e.g. when the balance has loaded). */
  ready?: boolean;
  className?: string;
}) {
  const coins = Math.max(MIN_COINS, Math.min(MAX_COINS, Math.round(count)));
  const allowed = useSyncExternalStore(subscribeMotion, canRender3D, () => false);
  const holder = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  // Mount the canvas only once it is actually on screen (display:none never intersects).
  useEffect(() => {
    const element = holder.current;
    if (!element || !allowed || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [allowed, seen]);

  const live = allowed && seen;
  return (
    <div ref={holder} aria-hidden="true" data-coin-stack={live ? "3d" : "static"} className={cn("pointer-events-none select-none", className)}>
      {live ? (
        <div className="pointer-events-auto h-full w-full">
          <CoinStackScene count={coins} drop={ready} />
        </div>
      ) : (
        <CoinStackStatic count={coins} />
      )}
    </div>
  );
}
