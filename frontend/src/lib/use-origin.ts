import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * The page's origin, or "" while rendering on the server. Integration URLs are built from it so a
 * phone gets the address it can reach; there is no hard-coded fallback host to go stale.
 */
export function useOrigin() {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}
