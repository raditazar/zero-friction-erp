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
import { Button } from "@/components/ui/button";
import { amount } from "@/components/dashboard/formatters";

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

function DeltaBadge({ delta }: { delta: number }) {
  const tone = delta > 0 ? "bg-positive-soft text-positive" : delta < 0 ? "bg-negative-soft text-negative" : "bg-paper-sunk text-ink";
  const text = delta === 0 ? "Tetap" : `${delta > 0 ? "+" : "-"}${amount(Math.abs(delta))}`;
  return <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${tone}`}>{text}</span>;
}

export function ReviewDialog({
  trigger,
  title,
  description,
  items,
  requireExplicitConsent = false,
  onConfirm,
  open,
  onOpenChange,
  confirmText = "Simpan",
  cancelText = "Batal",
  isConfirming = false,
  submitError,
}: ReviewDialogProps) {
  const [consentGiven, setConsentGiven] = useState(false);

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

            {/* Mobile: one stacked block per item instead of a wide table. */}
            <ul className="grid gap-2 md:hidden">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-line bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-sm font-semibold text-ink">{item.label}</span>
                    <DeltaBadge delta={item.after - item.before} />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-ink-soft">Sebelum</dt>
                      <dd className="mt-0.5 text-sm tabular-nums text-ink-soft">{amount(item.before)}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-ink-soft">Sesudah</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{amount(item.after)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-md border border-line md:block">
              <table className="w-full text-sm text-left">
                <thead className="bg-paper border-b border-line">
                  <tr>
                    <th className="px-4 py-3 font-medium text-ink">Item</th>
                    <th className="px-4 py-3 font-medium text-ink text-right">Sebelum</th>
                    <th className="px-4 py-3 font-medium text-ink text-right">Sesudah</th>
                    <th className="px-4 py-3 font-medium text-ink text-right">Dampak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.id} className="bg-card">
                      <td className="px-4 py-3 font-medium text-ink">{item.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{amount(item.before)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{amount(item.after)}</td>
                      <td className="px-4 py-3 text-right">
                        <DeltaBadge delta={item.after - item.before} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {requireExplicitConsent && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-paper-sunk p-3">
                <input
                  type="checkbox"
                  id="consent-checkbox"
                  className="mt-0.5 size-5 shrink-0 rounded border-line-strong accent-ink"
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
            <Button variant="outline" disabled={isConfirming}>
              {cancelText}
            </Button>
          </AppDialogClose>
          <Button onClick={onConfirm} disabled={(requireExplicitConsent && !consentGiven) || isConfirming}>
            {isConfirming ? "Memproses..." : confirmText}
          </Button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
