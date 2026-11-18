"use client";

import dynamic from "next/dynamic";
import { SuccessStampIllustration } from "@/components/illustrations";
import { SceneHost } from "./scene-host";

const ReceiptPileScene = dynamic(() => import("./receipt-pile-scene"), { ssr: false });

/** Static stand-in: a small fan of receipts, or the success stamp when nothing is left. */
function ReceiptPileStatic({ count }: { count: number }) {
  if (count === 0) return <SuccessStampIllustration className="h-full w-full" />;
  const shown = Math.min(count, 4);
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" aria-hidden="true">
      {Array.from({ length: shown }, (_, index) => {
        const offset = index - (shown - 1) / 2;
        return (
          <g key={index} transform={`translate(${60 + offset * 12} 52) rotate(${offset * -7})`}>
            <path
              d="M-17 -30h34v56l-4.25-3-4.25 3-4.25-3-4.25 3-4.25-3-4.25 3-4.25-3-4.25 3Z"
              fill="#FBF8F0"
              stroke="var(--line-strong)"
              strokeWidth="1.2"
            />
            <path d="M-10 -20h20M-10 -13h20M-10 -6h20M-10 1h11" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M2 12h8" stroke="var(--mint)" strokeWidth="3" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

export function ReceiptPile({
  count,
  lastDecision = 1,
  className,
}: {
  /** Pending inbox items; the pile shows up to five. 0 turns it into the stamp. */
  count: number;
  /** +1 if the last item was approved (flies right), -1 if rejected (flies left). */
  lastDecision?: number;
  className?: string;
}) {
  return (
    <SceneHost
      scene={ReceiptPileScene}
      props={{ count, lastDecision }}
      fallback={<ReceiptPileStatic count={count} />}
      className={className}
      interactive={false}
    />
  );
}
