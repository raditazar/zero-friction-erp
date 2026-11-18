"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { use3DAllowed } from "./capability";

/** Props every lazily loaded scene receives from the host, on top of its own. */
export type SceneActivity = {
  /** True while the canvas is on screen and the tab is visible: idle animation may run. */
  active: boolean;
};

function subscribeVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

const tabVisible = () => !document.hidden;

/**
 * Shared wrapper for every 3D object: mounts the (dynamically imported) scene only once it
 * scrolls into view, keeps telling it whether it is visible so idle loops can pause, and
 * renders the static fallback for reduced motion, Save-Data and weak devices.
 */
export function SceneHost<P extends object>({
  scene: Scene,
  props,
  fallback,
  className,
  interactive = true,
}: {
  /** A next/dynamic({ ssr: false }) component, so three stays out of the initial bundle. */
  scene: ComponentType<P & SceneActivity>;
  props: P;
  fallback: ReactNode;
  className?: string;
  /** Whether the canvas takes pointer input (drag/tap). */
  interactive?: boolean;
}) {
  const allowed = use3DAllowed();
  const holder = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const pageVisible = useSyncExternalStore(subscribeVisibility, tabVisible, () => true);

  // Mount once the holder is near the viewport, then keep tracking visibility for the idle clock.
  useEffect(() => {
    const element = holder.current;
    if (!element || !allowed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setOnScreen(visible);
        if (visible) setSeen(true);
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [allowed]);

  const live = allowed && seen;
  return (
    <div
      ref={holder}
      aria-hidden="true"
      data-3d={live ? "3d" : "static"}
      className={cn("pointer-events-none select-none", className)}
    >
      {live ? (
        <div className={cn("h-full w-full", interactive && "pointer-events-auto")}>
          <Scene {...props} active={onScreen && pageVisible} />
        </div>
      ) : (
        fallback
      )}
    </div>
  );
}
