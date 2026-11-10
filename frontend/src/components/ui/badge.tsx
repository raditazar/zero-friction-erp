import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center text-xs font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        primary: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-paper-sunk text-ink-soft border-line",
        neutral: "bg-paper-sunk text-ink-soft border-line",
        success: "bg-positive-soft text-positive border-positive-line",
        warning: "bg-caution-soft text-caution border-caution-line",
        danger: "bg-negative-soft text-negative border-negative-line",
        destructive: "bg-negative-soft text-negative border-negative-line",
        outline: "bg-transparent text-ink border-line",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
