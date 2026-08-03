import * as Select from "@radix-ui/react-select";
import type { ReactNode } from "react";

const currencyInputFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/feedback";

export function Panel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <section onClick={onClick} className={cn("rounded-2xl border border-[#E8E6E1] bg-[#FFFFFF] text-[#1A1A1A] p-6 shadow-xs", className)}>{children}</section>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-[#F0EEE9] px-2 py-1 text-xs font-mono font-medium text-[#1A1A1A]">{children}</span>;
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#F9F8F5] p-3">
      <dt className="text-xs font-mono uppercase tracking-wider text-[#6E6D7A]">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-[#1A1A1A]">{value}</dd>
    </div>
  );
}

export function DataList({
  rows,
}: {
  rows: { id: string; title: string; meta: string; action?: ReactNode }[];
}) {
  if (rows.length === 0) return <EmptyState title="Belum ada data" description="Data akan muncul setelah tersedia." />;
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E8E6E1] bg-[#FFFFFF] px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#1A1A1A]">{row.title}</p>
            <p className="mt-1 text-xs text-[#6E6D7A]">{row.meta}</p>
          </div>
          <div className="flex flex-wrap gap-1">{row.action}</div>
        </div>
      ))}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={label ? "grid gap-1.5 text-sm w-full" : "w-full"}>
      {label && <span className="text-[#6E6D7A] font-semibold">{label}</span>}
      <input className="flex h-9 w-full rounded-lg border border-[#E8E6E1] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1A1A1A] shadow-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/20 transition-all" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function normalizeCurrencyValue(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits;
}

function formatCurrencyValue(value: string) {
  const normalized = normalizeCurrencyValue(value);
  if (!normalized) return "";
  return currencyInputFormatter.format(Number(normalized));
}

export function CurrencyInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold text-[#6E6D7A]">{label}</span>
      <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[#E8E6E1] bg-[#FFFFFF] shadow-sm focus-within:ring-2 focus-within:ring-[#1A1A1A]/20 transition-all">
        <span className="flex items-center bg-[#F9F8F5] border-r border-[#E8E6E1] px-3 h-full font-mono text-[#6E6D7A]">Rp</span>
        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-right outline-none"
          inputMode="numeric"
          value={formatCurrencyValue(value)}
          onChange={(event) => onChange(normalizeCurrencyValue(event.target.value))}
          required={required}
        />
      </div>
    </label>
  );
}

export function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold text-[#6E6D7A]">{label}</span>
      <textarea className="flex min-h-[96px] w-full resize-y rounded-lg border border-[#E8E6E1] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1A1A1A] shadow-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/20 transition-all" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function SelectField({
  value,
  onValueChange,
  options,
  labels,
  placeholder = "Pilih opsi",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
  placeholder?: string;
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onValueChange}>
      <Select.Trigger className="flex h-9 w-full items-center justify-between rounded-lg border border-[#E8E6E1] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1A1A1A] shadow-sm hover:bg-[#F9F8F5] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/20 transition-all min-w-[120px]" aria-label={placeholder}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-[#6E6D7A] opacity-70">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 max-h-72 overflow-auto rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-1 text-[#1A1A1A] shadow-lg animate-in fade-in-80 zoom-in-95">
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option} value={option} className="cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[#F9F8F5] data-[highlighted]:text-[#1A1A1A] transition-colors">
                <Select.ItemText>{labels?.[option] ?? option}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
