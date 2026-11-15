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
      className={`relative flex flex-col rounded-2xl border border-negative-line bg-negative-soft shadow-sm p-6 text-negative ${className}`}
    >
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-3">
        <span className="text-xs font-mono font-bold tracking-widest text-negative uppercase">
          {code}
        </span>
        <AlertTriangle className="size-4 text-negative" />
      </div>

      {/* Main Error Title & Message */}
      <h4 className="text-sm font-bold tracking-tight text-negative">{title}</h4>
      <p className="mt-1 text-xs md:text-sm text-negative leading-relaxed">{message}</p>

      {/* Accordion Technical Details */}
      {technicalDetails && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs font-mono font-semibold text-negative hover:underline focus:outline-none"
          >
            {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {showDetails ? "Sembunyikan Log Teknis" : "Lihat Detail Diagnosis Teknis"}
          </button>
          {showDetails && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-negative-line bg-negative-soft p-3 text-xs font-mono text-negative whitespace-pre-wrap">
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
            className="bg-negative-solid text-white hover:bg-negative-solid text-xs px-4 py-2 font-medium flex items-center gap-2"
          >
            <RefreshCw className="size-3.5" />
            Coba Lagi
          </Button>
        </div>
      )}
    </div>
  );
}
