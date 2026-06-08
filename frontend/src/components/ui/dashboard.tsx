import * as Select from "@radix-ui/react-select";
import type { ReactNode } from "react";

const currencyInputFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

export function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded border border-zinc-800 bg-[#0b0e14] p-4 shadow-xl shadow-black/10">{children}</section>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-400">{children}</span>;
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
      <dt className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</dt>
      <dd className="mt-2 text-sm text-zinc-200">{value}</dd>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center">
      <p className="font-medium text-zinc-200">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{body}</p>
    </div>
  );
}

export function DataList({
  rows,
}: {
  rows: { id: string; title: string; meta: string; action?: ReactNode }[];
}) {
  if (rows.length === 0) return <EmptyState title="Nothing here" body="Data will appear after the backend receives it." />;
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-950/60 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{row.meta}</p>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-zinc-400">{label}</span>
      <input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
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
      <span className="text-zinc-400">{label}</span>
      <div className="field flex items-center gap-2 px-0 py-0">
        <span className="border-r border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-500">Rp</span>
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
      <span className="text-zinc-400">{label}</span>
      <textarea className="field min-h-24 resize-y" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function SelectField({
  value,
  onValueChange,
  options,
  labels,
  placeholder = "Select",
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
        <Select.Icon className="text-zinc-500">v</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 max-h-72 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-1 text-zinc-100 shadow-xl">
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option} value={option} className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-cyan-300 data-[highlighted]:text-zinc-950">
                <Select.ItemText>{labels?.[option] ?? option}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
