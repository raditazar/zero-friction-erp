"use client";

import React from "react";
import { AppCard } from "./app-card";
import { cn } from "@/lib/utils";

export interface EntityCardProps {
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: {
    label: string;
    variant?: "default" | "success" | "warning" | "danger";
  };
  icon?: React.ElementType;
  action?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function EntityCard({
  title,
  subtitle,
  amount,
  badge,
  icon: Icon,
  action,
  onClick,
  className = "",
}: EntityCardProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick();
  };

  const badgeVariants = {
    default: "bg-paper-sunk text-ink-soft",
    success: "bg-positive-solid text-mint",
    warning: "bg-caution-solid text-caution",
    danger: "bg-negative-solid text-negative-line",
  };

  return (
    <AppCard
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "group flex items-center justify-between gap-4 p-5 transition-colors",
        onClick && "cursor-pointer hover:bg-paper focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper text-ink group-hover:bg-paper-sunk transition-colors">
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-bold text-ink">{title}</h4>
            {badge && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-mono font-semibold",
                  badgeVariants[badge.variant || "default"]
                )}
              >
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="truncate text-xs text-ink-soft mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {amount && (
          <span className="text-base font-bold font-mono text-ink tabular-nums">
            {amount}
          </span>
        )}
        {action}
      </div>
    </AppCard>
  );
}
