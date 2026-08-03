"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "subtle" | "glass";
  className?: string;
}

export function AppCard({
  children,
  variant = "default",
  className = "",
  ...props
}: AppCardProps) {
  const variantStyles = {
    default: "bg-[#FFFFFF] text-[#1A1A1A] border border-[#E8E6E1] shadow-xs",
    subtle: "bg-[#F9F8F5] text-[#1A1A1A] border border-[#E8E6E1] shadow-none",
    glass: "bg-[#FFFFFF]/90 backdrop-blur-md text-[#1A1A1A] border border-[#E8E6E1]",
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl p-6 transition-all duration-200 outline-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AppCardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-between mb-4", className)}>{children}</div>;
}

export function AppCardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-bold tracking-tight text-[#1A1A1A]", className)}>{children}</h3>;
}

export function AppCardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs text-[#6E6D7A] leading-relaxed mt-0.5", className)}>{children}</p>;
}
