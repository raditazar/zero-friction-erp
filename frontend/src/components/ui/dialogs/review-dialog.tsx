"use client";

import React, { useState } from "react";
import {
  AppDialog,
  AppDialogTrigger,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogBody,
  AppDialogFooter,
  AppDialogClose,
} from "@/components/ui/dialog";

export type ReviewItem = {
  id: string | number;
  label: React.ReactNode;
  before: number;
  after: number;
};

export type ReviewDialogProps = {
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  items: ReviewItem[];
  requireExplicitConsent?: boolean;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  submitError?: string;
};

export function ReviewDialog({
  trigger,
  title,
  description,
  items,
  requireExplicitConsent = false,
  onConfirm,
  open,
  onOpenChange,
  confirmText = "Submit",
  cancelText = "Batal",
  isConfirming = false,
  submitError,
}: ReviewDialogProps) {
  const [consentGiven, setConsentGiven] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setConsentGiven(false);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <AppDialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <AppDialogTrigger asChild>{trigger}</AppDialogTrigger>}
      <AppDialogContent size="lg">
        <AppDialogHeader>
          <AppDialogTitle>{title}</AppDialogTitle>
          {description && (
            <AppDialogDescription>{description}</AppDialogDescription>
          )}
        </AppDialogHeader>
        <AppDialogBody>
          <div className="space-y-4">
            {submitError ? <p role="alert" aria-live="polite" className="rounded-md border border-negative-line bg-negative-soft px-3 py-2 text-sm font-medium text-negative">{submitError}</p> : null}
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="min-w-[500px] w-full text-sm text-left">
                <thead className="bg-paper border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium text-ink">Item</th>
                    <th className="px-4 py-3 font-medium text-ink text-right">Sebelum</th>
                    <th className="px-4 py-3 font-medium text-ink text-right">Sesudah</th>
                    <th className="px-4 py-3 font-medium text-ink text-right">Dampak</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const delta = item.after - item.before;
                    const deltaFormatted = formatCurrency(Math.abs(delta));
                    
                    return (
                      <tr key={item.id} className="bg-card">
                        <td className="px-4 py-3 font-medium text-ink">{item.label}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">{formatCurrency(item.before)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">{formatCurrency(item.after)}</td>
                        <td className="px-4 py-3 text-right">
                          {delta > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-positive-soft text-positive">
                              +{deltaFormatted}
                            </span>
                          )}
                          {delta < 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-negative-soft text-negative">
                              -{deltaFormatted}
                            </span>
                          )}
                          {delta === 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-paper-sunk text-ink">
                              Tetap
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {requireExplicitConsent && (
              <div className="flex items-start space-x-2 mt-4 p-3 bg-paper rounded-md border border-line">
                <input
                  type="checkbox"
                  id="consent-checkbox"
                  className="mt-1 h-4 w-4 rounded border-line-strong text-info focus:ring-info"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                />
                <label htmlFor="consent-checkbox" className="text-sm text-ink leading-relaxed cursor-pointer select-none">
                  Saya telah memeriksa dampak keuangan dan menyetujuinya
                </label>
              </div>
            )}
          </div>
        </AppDialogBody>
        <AppDialogFooter>
          <AppDialogClose asChild>
            <button disabled={isConfirming} className="min-h-[44px] px-4 py-2 text-sm font-medium text-ink bg-card border border-line-strong rounded-md hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info disabled:opacity-50">
              {cancelText}
            </button>
          </AppDialogClose>
          <button
            onClick={onConfirm}
            disabled={(requireExplicitConsent && !consentGiven) || isConfirming}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-info-solid border border-transparent rounded-md hover:bg-info-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? "Memproses..." : confirmText}
          </button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
