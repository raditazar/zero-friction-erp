"use client";

import React from "react";
import { AppCard, AppCardHeader, AppCardTitle, AppCardDescription } from "./app-card";
import { cn } from "@/lib/utils";

export interface ListCardProps {
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ListCard({ title, description, headerAction, children, className }: ListCardProps) {
  return (
    <AppCard className={cn("p-0 overflow-hidden", className)}>
      {(title || description || headerAction) && (
        <div className="p-5 border-b border-[#E8E6E1]">
          <AppCardHeader className="mb-0">
            <div>
              {title && <AppCardTitle>{title}</AppCardTitle>}
              {description && <AppCardDescription>{description}</AppCardDescription>}
            </div>
            {headerAction && <div>{headerAction}</div>}
          </AppCardHeader>
        </div>
      )}
      <div className="flex flex-col divide-y divide-[#E8E6E1]">
        {children}
      </div>
    </AppCard>
  );
}

export function ListCardItem({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 transition-colors text-[#1A1A1A]",
        onClick && "cursor-pointer hover:bg-[#F9F8F5]",
        className
      )}
    >
      {children}
    </div>
  );
}
