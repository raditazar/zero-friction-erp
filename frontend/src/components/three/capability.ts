"use client";

import { useSyncExternalStore } from "react";

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

let capable: boolean | undefined;

/**
 * 3D is a nicety, never a cost: skip it for reduced motion, Save-Data and weak devices.
 * localStorage "zfe-3d" = "on" | "off" overrides the heuristics for testing on a real device.
 */
export function canRender3D() {
  let override: string | null = null;
  try {
    override = localStorage.getItem("zfe-3d");
  } catch {
    override = null;
  }
  if (override === "off") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (capable === undefined) {
    const nav = navigator as Nav;
    const weak = (nav.deviceMemory !== undefined && nav.deviceMemory < 4) || (nav.hardwareConcurrency ?? 8) <= 4;
    capable = webglAvailable() && (override === "on" || !(weak || nav.connection?.saveData === true));
  }
  return capable;
}

function subscribeMotion(notify: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

/** True when this device should get the live 3D scene instead of its static fallback. */
export function use3DAllowed() {
  return useSyncExternalStore(subscribeMotion, canRender3D, () => false);
}
