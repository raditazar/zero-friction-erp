type FormatPrefs = { currency: string; locale: string; dateFormat: string };

const prefs: FormatPrefs = { currency: "IDR", locale: "id-ID", dateFormat: "DD/MM/YYYY" };
let currencyFormat = buildCurrencyFormat();

function buildCurrencyFormat() {
  try {
    return new Intl.NumberFormat(prefs.locale, {
      style: "currency",
      currency: prefs.currency,
      maximumFractionDigits: prefs.currency === "IDR" ? 0 : 2,
    });
  } catch {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  }
}

/** Applies the signed-in user's profile preferences to every formatter in this module. */
export function setFormatPrefs(next: { default_currency?: string | null; locale?: string | null; date_format?: string | null }) {
  if (next.default_currency) prefs.currency = next.default_currency;
  if (next.locale) prefs.locale = next.locale === "en" ? "en-US" : next.locale === "id" ? "id-ID" : next.locale;
  if (next.date_format) prefs.dateFormat = next.date_format;
  currencyFormat = buildCurrencyFormat();
}

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Tolerant numeric coercion for API values that arrive as strings or numbers. */
export function toNumber(value: string | number | null | undefined) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Parses money typed by a person: "100.000", "100,5", "Rp 1.250.000" (id-ID separators). */
export function parseMoneyInput(raw: string) {
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const normalized =
    lastComma >= 0
      ? `${cleaned.slice(0, lastComma).replace(/[.,]/g, "")}.${cleaned.slice(lastComma + 1).replace(/[.,]/g, "")}`
      : cleaned.replace(/\./g, "");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function amount(value: string | number | null | undefined) {
  return currencyFormat.format(toNumber(value));
}

const COMPACT_UNITS: Array<[number, string]> = [
  [1e12, "T"],
  [1e9, "M"],
  [1e6, "jt"],
  [1e3, "rb"],
];

function compactNumber(value: number) {
  const abs = Math.abs(value);
  for (const [size, unit] of COMPACT_UNITS) {
    if (abs >= size) {
      const scaled = abs / size;
      const digits = scaled >= 100 ? 0 : 1;
      const text = scaled.toLocaleString(prefs.locale, { maximumFractionDigits: digits });
      return `${value < 0 ? "-" : ""}${text} ${unit}`;
    }
  }
  return value.toLocaleString(prefs.locale, { maximumFractionDigits: 0 });
}

/** Short money for narrow cards and chart axes: "Rp 12,3 jt", "Rp 1,2 M". */
export function amountCompact(value: string | number | null | undefined) {
  const n = toNumber(value);
  const symbol = prefs.currency === "IDR" ? "Rp" : prefs.currency;
  return `${symbol} ${compactNumber(n)}`;
}

/** Axis ticks: no currency symbol, just "12,3 jt". */
export function compactTick(value: string | number | null | undefined) {
  return compactNumber(toNumber(value));
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(prefs.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Calendar day only, honouring the profile date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD). */
export function dayLabel(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return prefs.dateFormat.replace("DD", dd).replace("MM", mm).replace("YYYY", yyyy);
}

export function shortID(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "-";
}
