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
  label: string;
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
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-700">Item</th>
                    <th className="px-4 py-3 font-medium text-gray-700 text-right">Sebelum</th>
                    <th className="px-4 py-3 font-medium text-gray-700 text-right">Sesudah</th>
                    <th className="px-4 py-3 font-medium text-gray-700 text-right">Dampak</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => {
                    const delta = item.after - item.before;
                    const deltaFormatted = formatCurrency(Math.abs(delta));
                    
                    return (
                      <tr key={item.id} className="bg-white">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.label}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-600">{formatCurrency(item.before)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-900">{formatCurrency(item.after)}</td>
                        <td className="px-4 py-3 text-right">
                          {delta > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              +{deltaFormatted}
                            </span>
                          )}
                          {delta < 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              -{deltaFormatted}
                            </span>
                          )}
                          {delta === 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
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
              <div className="flex items-start space-x-2 mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <input
                  type="checkbox"
                  id="consent-checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                />
                <label htmlFor="consent-checkbox" className="text-sm text-gray-700 leading-relaxed cursor-pointer select-none">
                  Saya telah memeriksa dampak keuangan dan menyetujuinya
                </label>
              </div>
            )}
          </div>
        </AppDialogBody>
        <AppDialogFooter>
          <AppDialogClose asChild>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              {cancelText}
            </button>
          </AppDialogClose>
          <button
            onClick={() => {
              onConfirm();
              onOpenChange?.(false);
            }}
            disabled={requireExplicitConsent && !consentGiven}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmText}
          </button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
