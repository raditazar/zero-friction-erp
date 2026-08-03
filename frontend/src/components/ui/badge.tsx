import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center text-[11px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
  {
    variants: {
      variant: {
        default: "bg-[#1A1A1A] text-[#FFFFFF] border-transparent",
        primary: "bg-[#1A1A1A] text-[#FFFFFF] border-transparent",
        secondary: "bg-[#F0EEE9] text-[#6E6D7A] border-[#E8E6E1]",
        neutral: "bg-[#F0EEE9] text-[#6E6D7A] border-[#E8E6E1]",
        success: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
        warning: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
        danger: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
        destructive: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
        outline: "bg-transparent text-[#1A1A1A] border-[#E8E6E1]",
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
