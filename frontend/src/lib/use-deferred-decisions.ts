"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

export type Decision = "approve" | "reject";

const UNDO_WINDOW_MS = 5000;

type Pending<T> = { item: T; decision: Decision; timer: number };

/**
 * Approve/reject with an undo window instead of a confirmation dialog: the item disappears
 * from the list at once, a toast offers "Urungkan" for five seconds, and only then is the
 * API called. Leaving the page commits anything still pending, so no decision is lost.
 */
export function useDeferredDecisions<T extends { id: string }>({
  commit,
  describe,
  onSettled,
}: {
  /** Performs the real API call. */
  commit: (item: T, decision: Decision) => Promise<unknown>;
  /** Toast text, e.g. "Kopi Kenangan disetujui". */
  describe: (item: T, decision: Decision) => string;
  /** Runs after the API call succeeds (typically a revalidation). */
  onSettled?: () => void;
}) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const pending = useRef(new Map<string, Pending<T>>());
  const latest = useRef({ commit, describe, onSettled });

  useEffect(() => {
    latest.current = { commit, describe, onSettled };
  }, [commit, describe, onSettled]);

  const unhide = useCallback((id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const run = useCallback(
    async (id: string) => {
      const entry = pending.current.get(id);
      if (!entry) return;
      pending.current.delete(id);
      window.clearTimeout(entry.timer);
      try {
        await latest.current.commit(entry.item, entry.decision);
        latest.current.onSettled?.();
      } catch {
        unhide(id);
        toast.error(entry.decision === "approve" ? "Gagal menyetujui transaksi" : "Gagal menolak transaksi", {
          detail: "Transaksi dikembalikan ke antrean. Coba lagi.",
        });
      }
    },
    [unhide],
  );

  const decide = useCallback(
    (item: T, decision: Decision) => {
      if (pending.current.has(item.id)) return;
      setHidden((current) => new Set(current).add(item.id));
      const timer = window.setTimeout(() => void run(item.id), UNDO_WINDOW_MS);
      pending.current.set(item.id, { item, decision, timer });
      toast.success(latest.current.describe(item, decision), {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Urungkan",
          onClick: () => {
            const entry = pending.current.get(item.id);
            if (!entry) return;
            window.clearTimeout(entry.timer);
            pending.current.delete(item.id);
            unhide(item.id);
          },
        },
      });
    },
    [run, unhide],
  );

  // Navigating away must not silently drop decisions that are still inside their undo window.
  useEffect(() => {
    const queue = pending.current;
    return () => {
      for (const id of [...queue.keys()]) void run(id);
    };
  }, [run]);

  return { hidden, decide };
}
