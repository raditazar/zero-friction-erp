"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SceneHost } from "./scene-host";
import type { WalletCard } from "./wallet-cards-scene";

export type { WalletCard } from "./wallet-cards-scene";

const WalletCardsScene = dynamic(() => import("./wallet-cards-scene"), { ssr: false });

/** Flat fan of the same cards for reduced motion, Save-Data and weak devices. */
function WalletCardsStatic({ cards }: { cards: WalletCard[] }) {
  return (
    <div className="relative h-full w-full">
      {cards.map((card, index) => {
        const offset = index - (cards.length - 1) / 2;
        return (
          <div
            key={card.id}
            style={{
              backgroundColor: card.color,
              color: card.ink,
              transform: `translate(calc(-50% + ${offset * 26}%), -50%) rotate(${offset * 8}deg)`,
              zIndex: index,
            }}
            className="absolute left-1/2 top-1/2 flex aspect-[1.6] w-[46%] flex-col justify-between rounded-xl p-2.5 shadow-[0_10px_22px_-14px_var(--shadow-color)] ring-1 ring-black/5"
          >
            <span className="truncate text-xs font-semibold">{card.name}</span>
            <span className="truncate text-sm font-bold tabular-nums">{card.balance}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Up to four wallets as a fanned stack of physical cards. Tapping one brings it forward
 * and then calls onOpen (after the lift, so the motion reads before the sheet covers it).
 */
export function WalletCards({
  cards,
  onOpen,
  className,
}: {
  cards: WalletCard[];
  onOpen: (id: string) => void;
  className?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const pick = (id: string) => {
    setPicked(id);
    timers.current.push(
      window.setTimeout(() => onOpen(id), 280),
      window.setTimeout(() => setPicked(null), 1200),
    );
  };

  if (cards.length === 0) return null;
  return (
    <SceneHost
      scene={WalletCardsScene}
      props={{ cards, picked, onPick: pick }}
      fallback={<WalletCardsStatic cards={cards} />}
      className={className}
    />
  );
}
