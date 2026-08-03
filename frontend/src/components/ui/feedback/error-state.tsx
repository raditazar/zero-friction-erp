"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  code?: string; // Default: "ERR-500 // DIAGNOSTIC_FAILURE"
  title?: string;
  message: string;
  technicalDetails?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  code = "ERR-500 // DIAGNOSTIC_FAILURE",
  title = "Gagal Memuat Data Operasional",
  message,
  technicalDetails,
  onRetry,
  className = "",
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      role="alert"
      className={`relative flex flex-col rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-6 text-[#991B1B] ${className}`}
    >
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-3">
        <span className="text-[10px] font-mono font-bold tracking-widest text-[#B91C1C] uppercase">
          {code}
        </span>
        <AlertTriangle className="size-4 text-[#B91C1C]" />
      </div>

      {/* Main Error Title & Message */}
      <h4 className="text-sm font-bold tracking-tight text-[#7F1D1D]">{title}</h4>
      <p className="mt-1 text-xs md:text-sm text-[#991B1B] leading-relaxed">{message}</p>

      {/* Accordion Technical Details */}
      {technicalDetails && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[11px] font-mono font-semibold text-[#B91C1C] hover:underline focus:outline-none"
          >
            {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {showDetails ? "Sembunyikan Log Teknis" : "Lihat Detail Diagnosis Teknis"}
          </button>
          {showDetails && (
            <pre className="mt-2 max-h-40 overflow-auto rounded border border-[#FECACA] bg-[#FFF5F5] p-3 text-[10px] font-mono text-[#7F1D1D] whitespace-pre-wrap">
              {technicalDetails}
            </pre>
          )}
        </div>
      )}

      {/* Retry Action Button */}
      {onRetry && (
        <div className="mt-5">
          <Button
            onClick={onRetry}
            className="bg-[#991B1B] text-[#FFFFFF] hover:bg-[#7F1D1D] text-xs px-4 py-2 font-medium flex items-center gap-2"
          >
            <RefreshCw className="size-3.5" />
            Coba Lagi
          </Button>
        </div>
      )}
    </div>
  );
}
