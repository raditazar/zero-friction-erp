"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * Renders a number that counts from its previous value to `value`. The text is written
 * straight to the DOM on each frame, so counting never re-renders the parent.
 */
export function CountUp({
  value,
  format,
  className,
  duration = 1.1,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
  duration?: number;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const reduced = useReducedMotion();
  const formatRef = useRef(format);

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  // Layout effect: the starting value is written before paint, so the final number never flashes first.
  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;
    if (reduced) {
      shown.current = value;
      element.textContent = formatRef.current(value);
      return;
    }
    element.textContent = formatRef.current(Math.round(shown.current));
    const controls = animate(shown.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        shown.current = latest;
        element.textContent = formatRef.current(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  // The server/first render shows the final value, so screen readers and no-JS get the real number.
  return (
    <span ref={node} className={className} aria-label={format(value)}>
      {format(value)}
    </span>
  );
}
