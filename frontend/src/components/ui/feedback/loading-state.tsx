"use client";

import React from "react";

export interface LoadingStateProps {
  code?: string; // Default: "[SYS // SYNCING_TELEMETRY]"
  label?: string; // Default: "Memuat data operasional..."
  rows?: number; // Skeleton row count
  variant?: "card" | "table" | "metric";
  className?: string;
}

export function LoadingState({
  code = "[SYS // SYNCING_TELEMETRY]",
  label = "Memuat data operasional...",
  rows = 3,
  variant = "card",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`relative flex flex-col rounded-xl border border-[#E0DDD6] bg-[#FBF9F5] p-6 overflow-hidden ${className}`}
    >
      {/* Telemetry Header Line */}
      <div className="mb-4 flex items-center justify-between border-b border-[#E0DDD6]/60 pb-2">
        <span className="text-[10px] font-mono font-bold tracking-wider text-[#756f64] uppercase animate-pulse">
          {code}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1A1A1A] animate-ping" />
          <span className="text-[10px] font-mono text-[#756f64]">{label}</span>
        </div>
      </div>

      {/* Skeleton Rows */}
      {variant === "table" ? (
        <div className="space-y-3">
          <div className="h-8 w-full rounded bg-[#E0DDD6]/50 animate-pulse" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-6 w-1/4 rounded bg-[#E0DDD6]/40 animate-pulse" />
              <div className="h-6 w-1/2 rounded bg-[#E0DDD6]/30 animate-pulse" />
              <div className="h-6 w-1/4 rounded bg-[#E0DDD6]/40 animate-pulse" />
            </div>
          ))}
        </div>
      ) : variant === "metric" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-[#E0DDD6]/40 p-4 animate-pulse flex flex-col justify-between">
              <div className="h-3 w-1/3 rounded bg-[#E0DDD6]/60" />
              <div className="h-6 w-2/3 rounded bg-[#E0DDD6]/80" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-4 w-1/3 rounded bg-[#E0DDD6]/60 animate-pulse" />
          <div className="h-16 w-full rounded-lg bg-[#E0DDD6]/40 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-[#E0DDD6]/50 animate-pulse" />
        </div>
      )}
    </div>
  );
}
