"use client";

import { useEffect, type ReactNode } from "react";
import useSWR, { SWRConfig, mutate as globalMutate, type SWRConfiguration } from "swr";
import { api, type Category, type Transaction, type Wallet, type WalletBalance } from "@/lib/api";

/** Shared SWR cache keys. Anything finance-related that an approve/reject can change. */
export const KEYS = {
  inbox: "inbox",
  wallets: "wallets",
  walletBalances: "wallet-balances",
  categories: "categories",
  overview: "dashboard-overview",
  budget: (period: string) => ["budget", period] as const,
};

const INBOX_POLL_MS = 45_000;

const globalConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2_000,
  focusThrottleInterval: 5_000,
  errorRetryCount: 2,
  keepPreviousData: true,
};

export function AppSWRConfig({ children }: { children: ReactNode }) {
  return <SWRConfig value={globalConfig}>{children}</SWRConfig>;
}

export function useInbox() {
  return useSWR<Transaction[]>(KEYS.inbox, () => api.inbox(), {
    refreshInterval: INBOX_POLL_MS,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
}

export function useWallets() {
  return useSWR<Wallet[]>(KEYS.wallets, () => api.wallets());
}

export function useCategories() {
  return useSWR<Category[]>(KEYS.categories, () => api.categories());
}

export function useWalletBalances() {
  return useSWR<WalletBalance[]>(KEYS.walletBalances, () => api.analyticsWalletBalances());
}

/**
 * Revalidate everything a transaction status change can affect:
 * inbox counter/list, wallet balances, dashboard overview and every budget period.
 */
export function revalidateFinance() {
  return Promise.all([
    globalMutate(KEYS.inbox),
    globalMutate(KEYS.wallets),
    globalMutate(KEYS.walletBalances),
    globalMutate(KEYS.overview),
    globalMutate((key) => Array.isArray(key) && key[0] === "budget"),
  ]);
}

/** Mirrors the pending inbox count onto the installed PWA icon (iOS 16.4+, Android Chrome). */
export function useAppBadge(count: number) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (count > 0) void nav.setAppBadge?.(count)?.catch(() => {});
      else void nav.clearAppBadge?.()?.catch(() => {});
    } catch {
      /* Badging API unsupported or blocked */
    }
  }, [count]);
}
