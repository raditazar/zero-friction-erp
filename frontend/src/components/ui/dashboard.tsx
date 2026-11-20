import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/feedback";

export function Panel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <section onClick={onClick} className={cn("rounded-2xl surface-raised text-ink p-6", className)}>{children}</section>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-paper-sunk px-2 py-1 text-xs font-mono font-medium text-ink">{children}</span>;
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-paper p-3">
      <dt className="text-xs font-mono uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function DataList({
  rows,
}: {
  rows: { id: string; title: ReactNode; meta: ReactNode; action?: ReactNode }[];
}) {
  if (rows.length === 0) return <EmptyState compact title="Belum ada data" description="Data akan muncul di sini begitu tersedia." />;
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="surface-raised-sm flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{row.title}</div>
            <div className="mt-1 text-xs text-ink-soft">{row.meta}</div>
          </div>
          <div className="flex flex-wrap gap-1">{row.action}</div>
        </div>
      ))}
    </div>
  );
}
