"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { revalidateAll } from "@/lib/swr";
import { haptics } from "@/lib/haptics";

/** Finger travel (after resistance) that arms a refresh. */
const THRESHOLD = 68;
const MAX_PULL = 110;
/** Pull distance is half the finger travel, so the indicator lags the finger like a spring. */
const RESISTANCE = 0.5;
/** Keep the coin spinning at least this long so a fast refresh still reads as one. */
const MIN_SPIN_MS = 650;

type Phase = "idle" | "pulling" | "armed" | "refreshing";

/** Small mint coin drawn flat; it turns on its vertical axis while pulled and spins while loading. */
function Coin() {
  return (
    <svg viewBox="0 0 40 40" className="size-full" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="var(--mint)" />
      <circle cx="20" cy="20" r="13.5" fill="none" stroke="var(--mint-ink, #0B3D33)" strokeOpacity="0.35" strokeWidth="2" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill="var(--mint-ink, #0B3D33)"
        fontFamily="inherit"
      >
        Rp
      </text>
    </svg>
  );
}

/**
 * Pull-to-refresh for the installed PWA, where the browser's own gesture is off
 * (html has overscroll-behavior-y: contain). A downward drag from the very top of the page
 * brings in a coin; releasing past the threshold revalidates every SWR key and remounts the
 * page so effect-loaded views fetch again too.
 *
 * Ignored while a sheet or dialog is open, inside horizontal swipers, and for sideways drags.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const reduced = useReducedMotion();
  const indicator = useRef<HTMLDivElement>(null);
  const coin = useRef<HTMLDivElement>(null);
  const gesture = useRef({ startX: 0, startY: 0, pull: 0, tracking: false, decided: false, busy: false });

  useEffect(() => {
    const state = gesture.current;

    const paint = (pull: number, animate: boolean) => {
      const node = indicator.current;
      if (!node) return;
      node.style.transition = animate ? "transform 260ms var(--ease-out-soft), opacity 200ms" : "none";
      node.style.transform = `translate(-50%, ${pull - 56}px)`;
      node.style.opacity = String(Math.min(1, pull / (THRESHOLD * 0.6)));
      if (coin.current && !state.busy) coin.current.style.transform = `rotateY(${(pull / THRESHOLD) * 360}deg)`;
    };

    const blocked = (target: EventTarget | null) => {
      if (state.busy || window.scrollY > 0) return true;
      // Radix locks body scroll while a sheet or dialog is open.
      if (document.body.hasAttribute("data-scroll-locked")) return true;
      const element = target instanceof Element ? target : null;
      return Boolean(element?.closest('[role="dialog"], [data-no-pull], input, textarea, select, canvas'));
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || blocked(event.target)) {
        state.tracking = false;
        return;
      }
      const touch = event.touches[0];
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.pull = 0;
      state.tracking = true;
      state.decided = false;
    };

    const onMove = (event: TouchEvent) => {
      if (!state.tracking) return;
      const touch = event.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      if (!state.decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // Sideways or upward first: this is a swipe or a scroll, not a pull.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
          state.tracking = false;
          return;
        }
        state.decided = true;
      }
      event.preventDefault();
      const pull = Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE));
      const wasArmed = state.pull >= THRESHOLD;
      state.pull = pull;
      if (pull >= THRESHOLD && !wasArmed) {
        haptics.select();
        setPhase("armed");
      } else if (pull < THRESHOLD && wasArmed) {
        setPhase("pulling");
      } else if (pull > 0 && !wasArmed && pull < THRESHOLD) {
        setPhase((current) => (current === "idle" ? "pulling" : current));
      }
      paint(pull, false);
    };

    const onEnd = () => {
      if (!state.tracking) return;
      state.tracking = false;
      if (!state.decided) return;
      if (state.pull < THRESHOLD) {
        state.pull = 0;
        paint(0, true);
        setPhase("idle");
        return;
      }
      state.busy = true;
      setPhase("refreshing");
      paint(THRESHOLD * 0.85, true);
      const started = performance.now();
      void revalidateAll()
        .catch(() => undefined)
        .then(() => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, MIN_SPIN_MS - (performance.now() - started)))))
        .then(() => {
          setGeneration((value) => value + 1);
          haptics.success();
          state.busy = false;
          state.pull = 0;
          paint(0, true);
          setPhase("idle");
        });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const spinning = phase === "refreshing" && !reduced;

  return (
    <>
      <div
        ref={indicator}
        data-pull-indicator={phase}
        className="pointer-events-none fixed left-1/2 z-40 md:hidden"
        style={{ top: "calc(env(safe-area-inset-top) + 8px)", transform: "translate(-50%, -56px)", opacity: 0 }}
        aria-hidden="true"
      >
        <div className="grid size-11 place-items-center rounded-full border border-line bg-card shadow-[0_8px_20px_-12px_var(--shadow-color)] [perspective:200px]">
          <div ref={coin} className={spinning ? "ptr-coin-spin size-7" : "size-7"}>
            <Coin />
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        {phase === "refreshing" ? "Memuat ulang data" : ""}
      </p>
      <Fragment key={generation}>{children}</Fragment>
    </>
  );
}
