import type { Transition, Variants } from "framer-motion";

/** Shared motion vocabulary. Reduced motion is handled globally by <MotionConfig reducedMotion="user">. */
export const spring = {
  /** Snappy UI feedback: taps, toggles, indicator pills. */
  snap: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as Transition,
  /** Sheets, cards, page elements settling in. */
  soft: { type: "spring", stiffness: 300, damping: 30, mass: 0.9 } as Transition,
  /** Playful overshoot for celebratory or attention moments. */
  bouncy: { type: "spring", stiffness: 380, damping: 18, mass: 0.8 } as Transition,
};

export const duration = { fast: 0.14, base: 0.22, slow: 0.4 };
export const easeOutSoft = [0.2, 0.8, 0.2, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: spring.bouncy },
};

export const stagger = (step = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const sheet: Variants = {
  hidden: { y: "100%" },
  show: { y: 0, transition: spring.soft },
  exit: { y: "100%", transition: { duration: duration.base, ease: easeOutSoft } },
};

export const overlay: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
};

/** Press feedback for any tappable surface. */
export const tapScale = { whileTap: { scale: 0.96 }, transition: spring.snap } as const;
