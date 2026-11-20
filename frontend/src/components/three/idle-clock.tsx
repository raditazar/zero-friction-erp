"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

declare global {
  interface Window {
    /** Idle tick counter used by e2e to check the idle loop runs and pauses. */
    __zfe3dFrames?: number;
  }
}

/**
 * Drives idle animation for a frameloop="demand" canvas at a capped rate. Runs only while
 * `active` (canvas on screen, tab visible), so an idle object never burns battery off screen.
 */
export function IdleClock({ active, fps = 30 }: { active: boolean; fps?: number }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      // Counts only once a test has opted in by setting it to 0.
      if (window.__zfe3dFrames !== undefined) window.__zfe3dFrames += 1;
      invalidate();
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [active, fps, invalidate]);
  return null;
}
