"use client";

import { useEffect, useState } from "react";

/** Fixed scene palette. Scenes are lit, so they do not follow the CSS theme tokens. */
export const PALETTE = {
  ivory: "#F4EEE0",
  ivoryShade: "#D9CFBA",
  mint: "#19E6C1",
  mintDeep: "#0FB89A",
  caution: "#F5A524",
  negative: "#E5484D",
  ink: "#1A1A1A",
} as const;

type Disposable = { dispose: () => void };

/**
 * Builds three.js geometries/materials once and disposes every value with a dispose()
 * method (arrays included) when the scene unmounts.
 */
export function useDisposable<T extends Record<string, unknown>>(factory: () => T): T {
  const [assets] = useState(factory);
  useEffect(
    () => () => {
      const release = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(release);
        else if (value && typeof (value as Disposable).dispose === "function") (value as Disposable).dispose();
      };
      Object.values(assets).forEach(release);
    },
    [assets],
  );
  return assets;
}
