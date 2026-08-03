"use client";

import React, { useEffect } from "react";
import { Plus, Inbox, FileSpreadsheet, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  code?: string; // Default: "[SYS // EMPTY_RECORD]"
  title: string;
  description: string;
  icon?: React.ElementType;
  action?: {
    label: string;
    onClick: () => void;
    shortcutKey?: string; // E.g., "n" or "t"
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  code = "[SYS // EMPTY_RECORD]",
  title,
  description,
  icon: Icon = Inbox,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  // Listen for shortcut key
  useEffect(() => {
    if (!action?.shortcutKey || !action.onClick) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === action.shortcutKey?.toLowerCase() &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        action.onClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [action]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D5D2CC] bg-[#FBF9F5] p-8 md:p-12 text-center overflow-hidden ${className}`}
    >
      {/* Industrial Hairline Crosshair Accents */}
      <div className="absolute top-2 left-3 text-[9px] font-mono font-bold tracking-widest text-[#756f64]/60 uppercase">
        {code}
      </div>
      <div className="absolute top-2 right-3 text-[9px] font-mono text-[#756f64]/40">
        SCALE 1:1
      </div>

      {/* Icon Frame */}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] shadow-xs text-[#1A1A1A]">
        <Icon className="size-6 text-[#1A1A1A]" aria-hidden="true" />
      </div>

      {/* Content */}
      <h3 className="text-base font-bold tracking-tight text-[#1A1A1A]">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-xs md:text-sm text-[#756f64] leading-relaxed">
        {description}
      </p>

      {/* Action Buttons */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              className="bg-[#1A1A1A] text-[#FBF9F5] hover:bg-[#2D2D2D] text-xs px-4 py-2 font-medium flex items-center gap-2"
            >
              <Plus className="size-3.5" />
              {action.label}
              {action.shortcutKey && (
                <kbd className="ml-1.5 rounded border border-[#555] bg-[#333] px-1.5 py-0.5 text-[10px] font-mono text-[#FBF9F5]">
                  {action.shortcutKey.toUpperCase()}
                </kbd>
              )}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="border-[#E0DDD6] bg-[#FFFFFF] text-[#1A1A1A] hover:bg-[#F0EEE9] text-xs px-4 py-2 font-medium"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
