"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "framer-motion";
import { Check, ChevronRight, PencilLine, X } from "lucide-react";
import type { Category, Transaction, Wallet } from "@/lib/api";
import type { Decision } from "@/lib/use-deferred-decisions";
import { haptics } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { EmptyState } from "@/components/ui/feedback";
import { amount, cx, dayLabel, shortID } from "./formatters";

const FLING_DISTANCE = 110;
const FLING_VELOCITY = 650;
const VISIBLE = 3;

type Lookup = { walletById: Map<string, Wallet>; categoryById: Map<string, Category> };

function CardFace({ transaction, walletById, categoryById }: { transaction: Transaction } & Lookup) {
  const walletName = walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id);
  const categoryName = categoryById.get(transaction.category_id ?? "")?.name ?? "Belum ada kategori";
  const income = transaction.type === "income";
  return (
    <div className="flex h-full flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{transaction.merchant || "Tanpa nama"}</p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {walletName} · {categoryName}
          </p>
        </div>
        <span className="shrink-0 text-xs text-ink-soft">{dayLabel(transaction.transaction_at)}</span>
      </div>
      <p className={cx("font-display text-3xl font-semibold tabular-nums", income ? "text-positive" : "text-ink")}>
        {income ? "+" : "-"}
        {amount(transaction.amount)}
      </p>
    </div>
  );
}

function TopCard({
  transaction,
  onDecide,
  ...lookup
}: { transaction: Transaction; onDecide: (decision: Decision) => void } & Lookup) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const approveOpacity = useTransform(x, [20, FLING_DISTANCE], [0, 1]);
  const rejectOpacity = useTransform(x, [-FLING_DISTANCE, -20], [1, 0]);

  const fling = (decision: Decision, velocity = 0) => {
    haptics.success();
    const target = decision === "approve" ? 520 : -520;
    animate(x, target, reduced ? { duration: 0 } : { ...spring.snap, velocity }).then(() => onDecide(decision));
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > FLING_DISTANCE || info.velocity.x > FLING_VELOCITY) fling("approve", info.velocity.x);
    else if (info.offset.x < -FLING_DISTANCE || info.velocity.x < -FLING_VELOCITY) fling("reject", info.velocity.x);
    else animate(x, 0, spring.snap);
  };

  return (
    <motion.div
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      style={{ x, rotate, touchAction: "pan-y" }}
      initial={{ y: 12, scale: 0.96 }}
      animate={{ y: 0, scale: 1 }}
      transition={spring.soft}
      className="absolute inset-0 z-10 cursor-grab rounded-3xl surface-raised active:cursor-grabbing"
      data-inbox-card={transaction.id}
    >
      <motion.span
        aria-hidden="true"
        style={{ opacity: approveOpacity }}
        className="absolute left-5 top-5 -rotate-12 rounded-lg border-2 border-mint-ink bg-mint px-2 py-0.5 text-sm font-bold uppercase tracking-wider text-mint-ink"
      >
        Setujui
      </motion.span>
      <motion.span
        aria-hidden="true"
        style={{ opacity: rejectOpacity }}
        className="absolute right-5 top-5 rotate-12 rounded-lg border-2 border-negative px-2 py-0.5 text-sm font-bold uppercase tracking-wider text-negative"
      >
        Tolak
      </motion.span>
      <CardFace transaction={transaction} {...lookup} />
    </motion.div>
  );
}

/**
 * Inbox preview as a deck: swipe the top card right to approve, left to reject.
 * The buttons underneath do the same for keyboard and screen-reader users.
 */
export function InboxSwipeStack({
  items,
  total,
  onDecide,
  onEdit,
  onOpenAll,
  ...lookup
}: {
  items: Transaction[];
  total: number;
  onDecide: (transaction: Transaction, decision: Decision) => void;
  onEdit: (transaction: Transaction) => void;
  onOpenAll: () => void;
} & Lookup) {
  const top = items[0];
  const behind = items.slice(1, VISIBLE);

  return (
    <section aria-label="Perlu dicek" className="min-w-0 rounded-3xl border border-line bg-paper-sunk p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="section-title">Perlu dicek</h3>
          <p className="text-sm text-ink-soft">
            {total > 0 ? `${total.toLocaleString("id-ID")} transaksi menunggu. Geser kanan untuk setujui, kiri untuk tolak.` : "Tidak ada yang menunggu."}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Semua
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {top ? (
        <>
          <div className="relative mx-auto h-40 max-w-md">
            {behind
              .map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  aria-hidden="true"
                  initial={false}
                  animate={{ y: (index + 1) * 10, scale: 1 - (index + 1) * 0.045, rotate: index % 2 === 0 ? 2 : -2 }}
                  transition={spring.soft}
                  className="absolute inset-0 rounded-3xl surface-raised"
                >
                  <CardFace transaction={transaction} {...lookup} />
                </motion.div>
              ))
              .reverse()}
            <TopCard key={top.id} transaction={top} onDecide={(decision) => onDecide(top, decision)} {...lookup} />
          </div>
          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2">
            <button type="button" onClick={() => onDecide(top, "reject")} className="btn-secondary inline-flex items-center justify-center gap-1.5">
              <X className="size-4" aria-hidden="true" />
              Tolak
            </button>
            <button type="button" onClick={() => onEdit(top)} className="btn-secondary inline-flex items-center justify-center gap-1.5">
              <PencilLine className="size-4" aria-hidden="true" />
              Koreksi
            </button>
            <button type="button" onClick={() => onDecide(top, "approve")} className="btn-primary inline-flex items-center justify-center gap-1.5">
              <Check className="size-4" aria-hidden="true" />
              Setujui
            </button>
          </div>
        </>
      ) : (
        <EmptyState compact illustration="inbox" title="Kotak masuk bersih" description="Semua transaksi sudah dicek." />
      )}
    </section>
  );
}
