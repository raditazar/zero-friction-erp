"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getRouteMetadata, MORE_SLOT } from "@/lib/route-metadata";

const ACTION_SLOT_ID = "mobile-header-action";

function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

/**
 * Mobile top bar with the large-title pattern: a big display title sits in the page flow and
 * a compact copy fades into the sticky bar once it scrolls away. Pages opened from "Lainnya"
 * get a back button; the right side is a slot for the page's primary action.
 */
export function MobileAppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const metadata = getRouteMetadata(pathname);
  const title = metadata?.title ?? "satset";
  const isChild = (metadata?.dockSlot ?? MORE_SLOT) === MORE_SLOT;
  const scrolled = useScrolled(44);

  return (
    <>
      <header
        data-scrolled={scrolled}
        className="mobile-header sticky top-0 z-30 flex items-center gap-1 px-2 md:hidden"
        style={{ height: "calc(3rem + env(safe-area-inset-top, 0px))", paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex w-24 shrink-0 items-center">
          {isChild ? (
            <button
              type="button"
              aria-label="Kembali"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
              className="flex size-11 items-center justify-center rounded-full text-ink active:bg-paper-sunk"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo_square.png" alt="" className="ml-2 size-7 rounded-lg object-contain dark:invert" />
          )}
        </div>

        <p aria-hidden="true" className="mobile-header-title min-w-0 flex-1 truncate text-center text-base font-semibold text-ink">
          {title}
        </p>

        <div id={ACTION_SLOT_ID} className="flex w-24 shrink-0 items-center justify-end" />
      </header>

      <div className="px-4 pb-1 pt-0.5 md:hidden">
        <h1 className="font-display text-[2rem] font-semibold leading-[1.1] text-ink">{title}</h1>
      </div>
    </>
  );
}

/** Renders its children into the mobile header's right-hand action slot (nothing on desktop). */
export function MobileHeaderAction({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlot(document.getElementById(ACTION_SLOT_ID));
  }, []);
  return slot ? createPortal(children, slot) : null;
}
