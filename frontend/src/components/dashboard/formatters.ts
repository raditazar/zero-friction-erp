const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function amount(value: string | number | null | undefined) {
  return formatIDR.format(Number(value ?? 0));
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function shortID(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "-";
}
