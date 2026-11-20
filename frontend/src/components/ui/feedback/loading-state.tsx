import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Each variant mirrors the real layout of the page it stands in for, so content
 * lands where the skeleton was instead of the page jumping.
 */
export type LoadingVariant =
  | "list"
  | "card"
  | "table"
  | "metric"
  | "dashboard"
  | "inbox"
  | "wallets"
  | "budget"
  | "chart";

export interface LoadingStateProps {
  /** Announced to screen readers; never shown. */
  label?: string;
  rows?: number;
  variant?: LoadingVariant;
  className?: string;
}

function Bone({ className, height }: { className?: string; height?: string }) {
  return <div className={cn("skeleton", className)} style={height ? { height } : undefined} />;
}

function times(count: number, render: (index: number) => ReactNode) {
  return Array.from({ length: count }, (_, index) => render(index));
}

const surface = "rounded-2xl border border-line bg-card";

/** Avatar, two text lines and a trailing amount: the row shape used by every list. */
function Row({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Bone className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bone className={cn("h-3.5", index % 2 ? "w-2/5" : "w-3/5")} />
        <Bone className={cn("h-3", index % 2 ? "w-3/5" : "w-2/5")} />
      </div>
      <Bone className="h-4 w-20 shrink-0" />
    </div>
  );
}

function List({ rows }: { rows: number }) {
  return <div className={cn(surface, "divide-y divide-line px-4")}>{times(rows, (i) => <Row key={i} index={i} />)}</div>;
}

function MetricTiles({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      {times(count, (i) => (
        <div key={i} className={cn(surface, "space-y-4 p-4")}>
          <Bone className="h-3 w-2/3" />
          <Bone className="h-6 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function Chart() {
  const bars = [40, 62, 48, 80, 56, 92, 70, 44, 66, 84, 58, 74];
  return (
    <div className={cn(surface, "p-4 sm:p-6")}>
      <Bone className="h-3 w-24" />
      <Bone className="mt-2 h-5 w-44" />
      <div className="mt-6 flex h-44 items-end gap-2">
        {bars.map((height, i) => (
          <Bone key={i} className="flex-1 rounded-md" height={`${height}%`} />
        ))}
      </div>
    </div>
  );
}

function variantBody(variant: LoadingVariant, rows: number) {
  switch (variant) {
    case "dashboard":
      return (
        <div className="grid gap-5">
          <div className={cn(surface, "rounded-3xl p-5 sm:p-6")}>
            <Bone className="h-3 w-24" />
            <Bone className="mt-4 h-10 w-3/5" />
            <Bone className="mt-4 h-3.5 w-2/5" />
          </div>
          <MetricTiles count={3} className="grid-cols-2 lg:grid-cols-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1" />
          <Chart />
          <List rows={3} />
        </div>
      );
    case "inbox":
      return (
        <div className="grid gap-3">
          <Bone className="h-5 w-48" />
          <List rows={rows} />
        </div>
      );
    case "wallets":
      return (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {times(rows, (i) => (
            <div key={i} className={cn(surface, "space-y-6 p-4 sm:p-5")}>
              <div className="flex items-center gap-3">
                <Bone className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-3.5 w-1/2" />
                  <Bone className="h-3 w-1/3" />
                </div>
              </div>
              <Bone className="h-7 w-3/5" />
            </div>
          ))}
        </div>
      );
    case "budget":
      return (
        <div className="grid gap-6">
          <div className={cn(surface, "space-y-4 p-4")}>
            <Bone className="h-3 w-40" />
            <div className="grid grid-cols-3 gap-2">{times(3, (i) => <Bone key={i} className="h-10" />)}</div>
            <Bone className="h-2.5 w-full rounded-full" />
          </div>
          <div className={cn(surface, "divide-y divide-line px-4")}>
            {times(rows, (i) => (
              <div key={i} className="space-y-3 py-4">
                <div className="flex items-center justify-between gap-4">
                  <Bone className={cn("h-4", i % 2 ? "w-1/3" : "w-2/5")} />
                  <Bone className="h-4 w-24" />
                </div>
                <Bone className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      );
    case "metric":
      return <MetricTiles count={3} className="grid-cols-1 md:grid-cols-3" />;
    case "chart":
      return <Chart />;
    case "table":
      return (
        <div className={cn(surface, "p-4")}>
          <Bone className="h-9 w-full" />
          <div className="mt-2 divide-y divide-line">{times(rows, (i) => <Row key={i} index={i} />)}</div>
        </div>
      );
    case "card":
      return (
        <div className={cn(surface, "space-y-3 p-5")}>
          <Bone className="h-4 w-1/3" />
          <Bone className="h-16 w-full rounded-xl" />
          <Bone className="h-4 w-2/3" />
        </div>
      );
    case "list":
    default:
      return <List rows={rows} />;
  }
}

export function LoadingState({ label = "Sedang memuat…", rows = 4, variant = "list", className }: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" className={cn("w-full min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{variantBody(variant, rows)}</div>
    </div>
  );
}
