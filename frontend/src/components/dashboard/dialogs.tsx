"use client";

import type { Transaction } from "@/lib/api";
import {
  AppDialog,
  AppDialogBody,
  AppDialogClose,
  AppDialogContent,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { amount } from "./formatters";

export function AllocationDialog({
  open,
  transaction,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const value = Number(transaction?.amount ?? 0);
  const rows = [
    { label: "Siap dibelanjakan", bar: "bg-info-solid" },
    { label: "Tabungan / investasi", bar: "bg-mint" },
  ];
  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="md">
        <AppDialogHeader>
          <AppDialogTitle>Bagi pemasukan ini</AppDialogTitle>
          <AppDialogDescription>
            Pratinjau alokasi sebelum pemasukan masuk ke saldo siap belanja.
          </AppDialogDescription>
        </AppDialogHeader>
        <AppDialogBody>
          <div className="grid gap-4 rounded-2xl surface-raised p-4">
            {rows.map((row) => (
              <div key={row.label}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-ink-soft">{row.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{amount(value * 0.5)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-sunk">
                  <div className={`h-full w-1/2 rounded-full ${row.bar}`} />
                </div>
              </div>
            ))}
          </div>
        </AppDialogBody>
        <AppDialogFooter>
          <AppDialogClose asChild>
            <Button variant="outline">Batal</Button>
          </AppDialogClose>
          <Button disabled={busy} onClick={onConfirm}>
            Konfirmasi alokasi
          </Button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
