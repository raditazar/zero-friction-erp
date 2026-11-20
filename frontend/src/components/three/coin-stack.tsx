"use client";

import dynamic from "next/dynamic";
import { CoinStackStatic } from "@/components/illustrations/coin-stack-static";
import { SceneHost } from "./scene-host";

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
  return (
    <SceneHost
      scene={CoinStackScene}
      props={{ count: coins, drop: ready }}
      fallback={<CoinStackStatic count={coins} />}
      className={className}
    />
  );
}
