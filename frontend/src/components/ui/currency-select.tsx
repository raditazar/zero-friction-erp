"use client";

import { CURRENCY_OPTIONS } from "@/lib/provider-catalog";
import { SelectField } from "./form";
import type { SelectHTMLAttributes } from "react";

interface CurrencySelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> {
  value: string;
  onValueChange: (code: string) => void;
}

export function CurrencySelect({
  value,
  onValueChange,
  ...props
}: CurrencySelectProps) {
  return (
    <SelectField
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...props}
    >
      {CURRENCY_OPTIONS.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} — {c.name} ({c.symbol})
        </option>
      ))}
    </SelectField>
  );
}
