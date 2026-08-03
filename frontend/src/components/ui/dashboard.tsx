import * as Select from "@radix-ui/react-select";
import type { ReactNode } from "react";

const currencyInputFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

import { cn } from "@/lib/utils";

export function Panel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <section onClick={onClick} className={cn("rounded-xl bg-[#F0EEE9] text-[#1A1A1A] p-5", className)}>{children}</section>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-[#E8E5DF] px-2 py-1 text-xs font-medium text-[#5A5A5A]">{children}</span>;
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#FBF9F5] p-3">
      <dt className="text-xs uppercase tracking-[0.14em] text-[#5A5A5A]">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-[#1A1A1A]">{value}</dd>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#D5D2CC] bg-[#FBF9F5] p-8 text-center">
      <p className="font-semibold text-[#1A1A1A]">{title}</p>
      <p className="mt-2 text-sm text-[#5A5A5A]">{body}</p>
    </div>
  );
}

export function DataList({
  rows,
}: {
  rows: { id: string; title: string; meta: string; action?: ReactNode }[];
}) {
  if (rows.length === 0) return <EmptyState title="Belum ada data" body="Data akan muncul setelah tersedia." />;
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E0DDD6] bg-[#FBF9F5] px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.title}</p>
            <p className="mt-1 text-xs text-[#5A5A5A]">{row.meta}</p>
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
    <label className="grid gap-1 text-sm">
      <span className="text-[#5A5A5A] font-medium">{label}</span>
      <input className="field" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} required={required} />
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
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-[#5A5A5A]">{label}</span>
      <div className="field flex items-center gap-2 px-0 py-0">
        <span className="px-3 py-2 text-xs font-medium text-[#5A5A5A]">Rp</span>
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
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-[#5A5A5A]">{label}</span>
      <textarea className="field min-h-24 resize-y" value={value} onChange={(event) => onChange(event.target.value)} />
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
      <Select.Trigger className="field flex h-9 items-center justify-between" aria-label={placeholder}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-[#5A5A5A]">v</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 max-h-72 overflow-auto rounded-lg border border-[#E0DDD6] bg-[#FBF9F5] p-1 text-[#1A1A1A] shadow-lg">
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option} value={option} className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-[#E8E5DF] data-[highlighted]:text-[#1A1A1A]">
                <Select.ItemText>{labels?.[option] ?? option}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
