"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Wallet, WalletBalance } from "@/lib/api";
import { providerBrand, resolveProviderSlug } from "@/lib/provider-catalog";
import { ProviderAvatar } from "@/components/ui/provider-avatar";
import { stagger, spring } from "@/lib/motion";
import { amount } from "./formatters";

/** Small fixed tilts so the row reads as cards laid on a desk rather than a grid. */
const TILTS = [-2.5, 1.5, -1, 2, -1.5, 1];

/**
 * Horizontally scrolling row of physical-looking wallet cards in their provider's colours.
 * Scroll-snaps one card at a time on touch; each card is a real button.
 */
export function WalletStrip({
  balances,
  walletById,
  onOpen,
  onAll,
}: {
  balances: WalletBalance[];
  walletById: Map<string, Wallet>;
  onOpen: (walletId: string) => void;
  onAll: () => void;
}) {
  if (balances.length === 0) return null;
  const sorted = [...balances].sort((a, b) => Number(b.curr_balance) - Number(a.curr_balance));

  return (
    <section aria-label="Dompet" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="section-title">Dompet</h3>
        <button type="button" onClick={onAll} className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-ink-soft hover:text-ink">
          Semua
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      {/* The row sits in a sunk tray so the brand-coloured cards read as resting in the paper. */}
      <div className="rounded-3xl surface-inset">
        <motion.ul
          variants={stagger(0.06)}
          initial="hidden"
          animate="show"
          className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto rounded-3xl px-4 pb-5 pt-4"
        >
          {sorted.map((balance, index) => {
            const wallet = walletById.get(balance.wallet_id);
            const brand = providerBrand(wallet?.provider, wallet?.provider_slug);
            const slug = resolveProviderSlug(wallet?.provider, wallet?.provider_slug);
            const tilt = TILTS[index % TILTS.length];
            return (
              <motion.li
                key={balance.wallet_id}
                variants={{
                  hidden: { opacity: 0, y: 18, rotate: 0 },
                  show: {
                    opacity: 1,
                    y: 0,
                    rotate: tilt,
                    transition: spring.soft,
                  },
                }}
                className="shrink-0 snap-start"
              >
                <motion.button
                  type="button"
                  onClick={() => onOpen(balance.wallet_id)}
                  whileTap={{ scale: 0.97, rotate: 0 }}
                  style={{ backgroundColor: brand.color, color: brand.ink }}
                  className="relative flex h-32 w-56 flex-col justify-between overflow-hidden rounded-2xl p-4 text-left shadow-[var(--soft-raised-sm)] ring-1 ring-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {/* Soft sheen so flat brand colours still read as a card. */}
                  <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-white/15" />
                  <span className="flex items-center gap-2">
                    <ProviderAvatar slug={slug} name={wallet?.provider ?? balance.name} size={28} className="rounded-lg" />
                    <span className="truncate text-sm font-semibold">{balance.name}</span>
                  </span>
                  <span>
                    <span className="block text-xs font-medium">{wallet?.account_number ? `•••• ${wallet.account_number.slice(-4)}` : balance.category}</span>
                    <span className="mt-0.5 block truncate text-lg font-semibold tabular-nums">{amount(balance.curr_balance)}</span>
                  </span>
                </motion.button>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}
