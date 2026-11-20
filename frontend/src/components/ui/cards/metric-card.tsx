"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AppCard } from "./app-card";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  badgeText?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  badgeText,
  className = "",
}: MetricCardProps) {
  return (
    <AppCard className={cn("flex flex-col justify-between space-y-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-mono font-medium tracking-wider text-ink-soft uppercase">
            {label}
          </span>
          {subtitle && (
            <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-ink">
            <Icon className="size-4" />
          </div>
        )}
        {badgeText && !Icon && (
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-mono font-medium text-ink">
            {badgeText}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink tabular-nums">
          {value}
        </span>

        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium font-mono",
              trend.isNeutral
                ? "bg-paper-sunk text-ink-soft"
                : trend.isPositive
                ? "bg-positive-soft text-positive border border-positive-line"
                : "bg-negative-soft text-negative border border-negative-line"
            )}
          >
            {trend.isNeutral ? (
              <Minus className="size-3" />
            ) : trend.isPositive ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </AppCard>
  );
}
