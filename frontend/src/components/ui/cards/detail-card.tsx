"use client";

import React from "react";
import { AppCard } from "./app-card";
import { cn } from "@/lib/utils";

export function DetailCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <AppCard className={className}>{children}</AppCard>;
}

export function DetailItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4 border-b border-[#E8E6E1] last:border-0", className)}>
      <span className="text-sm text-[#6E6D7A]">{label}</span>
      <div className="text-sm font-medium text-[#1A1A1A]">{value}</div>
    </div>
  );
}
