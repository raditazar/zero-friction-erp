"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Info } from "lucide-react";
import { useMediaQuery } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function InfoTooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface InfoTooltipProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  ariaLabel?: string;
  className?: string;
}

const bubbleClass =
  "z-[60] max-w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-primary px-3 py-2 text-xs font-medium leading-relaxed text-primary-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

/** Hover tooltip with a pointer; tap-to-open popover on touch screens (hover tooltips never open there). */
export function InfoTooltip({
  content,
  side = "top",
  ariaLabel = "Informasi tambahan",
  className,
}: InfoTooltipProps) {
  const isTouch = useMediaQuery("(pointer: coarse)");

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "touch-compact inline-flex items-center justify-center rounded-full p-0.5 max-md:-m-[13px] max-md:min-h-11 max-md:min-w-11 text-ink-soft hover:text-ink",
        className
      )}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );

  if (isTouch) {
    return (
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content side={side} sideOffset={2} collisionPadding={12} className={bubbleClass}>
            {content}
            <PopoverPrimitive.Arrow className="fill-primary" />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={5} className={bubbleClass}>
          {content}
          <TooltipPrimitive.Arrow className="fill-primary" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
