"use client";

import { useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SwipeAction = {
  label: string;
  icon: LucideIcon;
  tone: "mint" | "negative" | "caution" | "ink";
  /** Called once the row has been flung past the threshold. */
  onCommit: () => void;
};

const TONES: Record<SwipeAction["tone"], string> = {
  mint: "bg-mint text-mint-ink",
  negative: "bg-negative-solid text-white",
  caution: "bg-caution-solid text-ink",
  ink: "bg-ink text-paper",
};

/** Share of the row width the finger has to travel before a release commits the action. */
const THRESHOLD = 0.35;
const FLING_VELOCITY = 700;

/**
 * A list row that commits an action when swiped: right reveals `right`, left reveals `left`.
 * Swiping is a shortcut only; every action must also exist as a visible button in the row
 * or its detail view, so keyboard and screen-reader users are never locked out.
 */
export function SwipeRow({
  children,
  right,
  left,
  disabled = false,
  className,
}: {
  children: ReactNode;
  /** Action revealed when the row is pulled to the right (e.g. approve). */
  right?: SwipeAction;
  /** Action revealed when the row is pulled to the left (e.g. reject). */
  left?: SwipeAction;
  disabled?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const holder = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const armed = useRef<"left" | "right" | null>(null);
  const dragged = useRef(false);

  const rightOpacity = useTransform(x, [0, 24], [0, 1]);
  const leftOpacity = useTransform(x, [-24, 0], [1, 0]);
  const rightIconScale = useTransform(x, [0, 120], [0.7, 1.1]);
  const leftIconScale = useTransform(x, [-120, 0], [1.1, 0.7]);

  const width = () => holder.current?.offsetWidth ?? 320;

  const onDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 6) dragged.current = true;
    const limit = width() * THRESHOLD;
    const next = info.offset.x > limit && right ? "right" : info.offset.x < -limit && left ? "left" : null;
    if (next !== armed.current) {
      armed.current = next;
      if (next) haptics.select();
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const limit = width() * THRESHOLD;
    const goRight = right && (info.offset.x > limit || (info.velocity.x > FLING_VELOCITY && info.offset.x > 24));
    const goLeft = left && (info.offset.x < -limit || (info.velocity.x < -FLING_VELOCITY && info.offset.x < -24));
    armed.current = null;
    const action = goRight ? right : goLeft ? left : undefined;
    if (!action) {
      animate(x, 0, spring.snap);
      return;
    }
    haptics.success();
    const target = (goRight ? 1 : -1) * width() * 1.1;
    animate(x, target, reduced ? { duration: 0 } : { ...spring.snap, velocity: info.velocity.x }).then(() => {
      action.onCommit();
      // The parent usually removes the row; if it stays (e.g. undo), bring it back.
      x.set(0);
    });
  };

  return (
    <div ref={holder} className={cn("relative overflow-hidden", className)}>
      {right ? (
        <motion.div
          aria-hidden="true"
          style={{ opacity: rightOpacity }}
          className={cn("absolute inset-0 flex items-center justify-start gap-2 px-5 text-sm font-semibold", TONES[right.tone])}
        >
          <motion.span style={{ scale: rightIconScale }} className="flex">
            <right.icon className="size-5" />
          </motion.span>
          {right.label}
        </motion.div>
      ) : null}
      {left ? (
        <motion.div
          aria-hidden="true"
          style={{ opacity: leftOpacity }}
          className={cn("absolute inset-0 flex items-center justify-end gap-2 px-5 text-sm font-semibold", TONES[left.tone])}
        >
          {left.label}
          <motion.span style={{ scale: leftIconScale }} className="flex">
            <left.icon className="size-5" />
          </motion.span>
        </motion.div>
      ) : null}
      <motion.div
        drag={disabled || (!left && !right) ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: left ? 0.9 : 0.05, right: right ? 0.9 : 0.05 }}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = false;
        }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClickCapture={(event) => {
          // A drag that ends over the row must not also count as a tap.
          if (dragged.current) {
            event.stopPropagation();
            event.preventDefault();
            dragged.current = false;
          }
        }}
        style={{ x, touchAction: "pan-y" }}
        className="relative bg-card"
      >
        {children}
      </motion.div>
    </div>
  );
}
