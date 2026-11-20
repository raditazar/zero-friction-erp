"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { illustrations, type IllustrationName } from "@/components/illustrations";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  /** Named drawing from components/illustrations, or any node. Defaults to the blank ledger. */
  illustration?: IllustrationName | ReactNode;
  /** The one thing to do next. */
  action?: { label: string; onClick: () => void; disabled?: boolean };
  /** Quiet alternative, rendered as a text button. Use sparingly. */
  secondaryAction?: { label: string; onClick: () => void };
  /** Smaller drawing and padding, for use inside an existing card. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  illustration = "ledger",
  action,
  secondaryAction,
  compact = false,
  className,
}: EmptyStateProps) {
  let art: ReactNode = illustration;
  if (typeof illustration === "string") {
    const Art = illustrations[illustration as IllustrationName];
    art = Art ? <Art className={compact ? "h-20" : "h-28"} /> : null;
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      {art}
      <h3 className={cn("font-semibold tracking-tight text-ink", compact ? "mt-3 text-base" : "mt-5 text-lg")}>{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-col items-center gap-1">
          {action ? (
            <Button onClick={action.onClick} disabled={action.disabled} className="h-11 rounded-xl px-5 text-sm font-semibold">
              {action.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button variant="ghost" onClick={secondaryAction.onClick} className="h-11 rounded-xl px-4 text-sm font-medium text-ink-soft">
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
