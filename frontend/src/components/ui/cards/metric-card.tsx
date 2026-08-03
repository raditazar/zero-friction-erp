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
          <span className="text-xs font-mono font-medium tracking-wider text-[#6E6D7A] uppercase">
            {label}
          </span>
          {subtitle && (
            <p className="text-[11px] text-[#6E6D7A] mt-0.5">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F3EE] text-[#1A1A1A]">
            <Icon className="size-4" />
          </div>
        )}
        {badgeText && !Icon && (
          <span className="rounded-full bg-[#F4F3EE] px-2.5 py-0.5 text-[10px] font-mono font-medium text-[#1A1A1A]">
            {badgeText}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#1A1A1A] tabular-nums">
          {value}
        </span>

        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium font-mono",
              trend.isNeutral
                ? "bg-[#F0EEE9] text-[#6E6D7A]"
                : trend.isPositive
                ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
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
