"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Inbox, LayoutGrid, Plus, ReceiptText, type LucideIcon } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { getDockSlot, MORE_SLOT } from "@/lib/route-metadata";

type MobileDockProps = {
  pendingCount?: number;
  moreOpen?: boolean;
  onCapture: () => void;
  onMore: () => void;
};

const BLOT_RADIUS = "58% 42% 52% 48% / 55% 45% 55% 45%";
const BLOB_RADIUS = "46% 54% 50% 50% / 55% 48% 52% 45%";

/** True while the user scrolls down the page; flips back as soon as they scroll up. */
function useScrollingDown() {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setDown(y > last && y > 96);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return down;
}

function SlotBody({ icon: Icon, label, active, badge }: { icon: LucideIcon; label: string; active: boolean; badge?: number }) {
  return (
    <>
      <span className="relative flex h-8 w-14 items-center justify-center">
        {active ? (
          <motion.span
            layoutId="dock-blot"
            transition={spring.snap}
            className="absolute inset-0 bg-paper-sunk shadow-[var(--soft-pressed)]"
            style={{ borderRadius: BLOT_RADIUS }}
          />
        ) : null}
        <Icon className="relative size-[1.375rem]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
        {badge ? (
          <span className="absolute -top-0.5 right-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-negative-solid px-1 text-xs font-bold leading-none text-white ring-2 ring-paper">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="dock-label text-xs font-semibold leading-none tracking-tight">{label}</span>
    </>
  );
}

const slotClass = (active: boolean) =>
  `touch-compact flex min-h-[3.25rem] min-w-11 flex-col items-center justify-center gap-1 rounded-2xl outline-none transition-colors ${
    active ? "text-ink" : "text-ink-soft"
  }`;

/** Five-slot mobile dock: Beranda, Buku Besar, Catat (raised), Kotak Masuk, Lainnya. */
export function MobileDock({ pendingCount = 0, moreOpen = false, onCapture, onMore }: MobileDockProps) {
  const pathname = usePathname();
  const slot = moreOpen ? MORE_SLOT : getDockSlot(pathname);
  const compact = useScrollingDown();

  const link = (index: number, href: string, label: string, icon: LucideIcon, ariaLabel?: string, badge?: number) => (
    <Link
      href={href}
      data-touch=""
      aria-label={ariaLabel}
      aria-current={slot === index ? "page" : undefined}
      onClick={() => haptics.tap()}
      className={slotClass(slot === index)}
    >
      <SlotBody icon={icon} label={label} active={slot === index} badge={badge} />
    </Link>
  );

  return (
    <nav
      aria-label="Navigasi utama"
      data-compact={compact}
      className="mobile-dock fixed inset-x-3 z-40 mx-auto grid max-w-md grid-cols-5 items-center rounded-[1.75rem] surface-raised px-1.5 py-1 md:hidden"
    >
      {link(0, "/", "Beranda", Home)}
      {link(1, "/transactions", "Buku Besar", ReceiptText)}

      <div className="flex flex-col items-center gap-1">
        <motion.button
          type="button"
          aria-label="Catat transaksi"
          whileTap={{ scale: 0.9, rotate: 0 }}
          transition={spring.bouncy}
          onClick={() => {
            haptics.select();
            onCapture();
          }}
          className="dock-catat -mt-7 flex size-[3.75rem] -rotate-6 items-center justify-center bg-mint text-mint-ink"
          style={{ borderRadius: BLOB_RADIUS }}
        >
          <Plus className="size-7 rotate-6" strokeWidth={2.6} aria-hidden="true" />
        </motion.button>
        <span aria-hidden="true" className="dock-label text-xs font-bold leading-none tracking-tight text-ink">
          Catat
        </span>
      </div>

      {link(
        3,
        "/inbox",
        "Inbox",
        Inbox,
        pendingCount > 0 ? `Kotak Masuk, ${pendingCount} menunggu` : "Kotak Masuk",
        pendingCount
      )}

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={() => {
          haptics.tap();
          onMore();
        }}
        className={slotClass(slot === MORE_SLOT)}
      >
        <SlotBody icon={LayoutGrid} label="Lainnya" active={slot === MORE_SLOT} />
      </button>
    </nav>
  );
}
