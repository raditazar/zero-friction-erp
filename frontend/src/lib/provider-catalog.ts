export interface ProviderItem {
  slug: string;
  name: string;
  category: "bank" | "e-wallet" | "credit-card" | "other";
  aliases?: string[];
}

export const PROVIDER_CATALOG: ProviderItem[] = [
  // Banks
  { slug: "bca", name: "Bank Central Asia (BCA)", category: "bank", aliases: ["bca", "central asia"] },
  { slug: "mandiri", name: "Bank Mandiri", category: "bank", aliases: ["mandiri", "bmri"] },
  { slug: "bni", name: "Bank Negara Indonesia (BNI)", category: "bank", aliases: ["bni"] },
  { slug: "bri", name: "Bank Rakyat Indonesia (BRI)", category: "bank", aliases: ["bri"] },
  { slug: "bsi", name: "Bank Syariah Indonesia (BSI)", category: "bank", aliases: ["bsi", "syariah"] },
  { slug: "jago", name: "Bank Jago", category: "bank", aliases: ["jago", "artos"] },
  { slug: "seabank", name: "SeaBank", category: "bank", aliases: ["seabank", "sea"] },
  { slug: "blu-by-bca-digital", name: "blu by BCA Digital", category: "bank", aliases: ["blu", "bca digital"] },
  { slug: "jenius", name: "Jenius (BTPN)", category: "bank", aliases: ["jenius", "btpn"] },
  { slug: "permata", name: "Bank Permata", category: "bank", aliases: ["permata"] },
  { slug: "cimb", name: "CIMB Niaga", category: "bank", aliases: ["cimb", "niaga"] },
  { slug: "danamon", name: "Bank Danamon", category: "bank", aliases: ["danamon"] },
  { slug: "btn", name: "Bank Tabungan Negara (BTN)", category: "bank", aliases: ["btn"] },
  { slug: "bank-bjb", name: "Bank BJB", category: "bank", aliases: ["bjb"] },
  { slug: "bank-neo-commerce", name: "Bank Neo Commerce (BNC)", category: "bank", aliases: ["neo", "bnc"] },
  { slug: "allo", name: "Allo Bank", category: "bank", aliases: ["allo"] },
  { slug: "panin", name: "Bank Panin", category: "bank", aliases: ["panin"] },
  { slug: "ocbc", name: "OCBC NISP", category: "bank", aliases: ["ocbc", "nisp"] },
  { slug: "maybank-indonesia", name: "Maybank Indonesia", category: "bank", aliases: ["maybank"] },
  { slug: "dbs", name: "DBS / digibank", category: "bank", aliases: ["dbs", "digibank"] },

  // E-Wallets
  { slug: "gopay", name: "GoPay", category: "e-wallet", aliases: ["gopay", "gojek"] },
  { slug: "ovo", name: "OVO", category: "e-wallet", aliases: ["ovo"] },
  { slug: "dana", name: "DANA", category: "e-wallet", aliases: ["dana"] },
  { slug: "shopeepay", name: "ShopeePay", category: "e-wallet", aliases: ["shopee", "shopeepay"] },
  { slug: "linkaja", name: "LinkAja", category: "e-wallet", aliases: ["linkaja", "tcash"] },
  { slug: "astra-pay", name: "AstraPay", category: "e-wallet", aliases: ["astrapay"] },

  // Cards & Financing
  { slug: "visa", name: "Visa Card", category: "credit-card", aliases: ["visa"] },
  { slug: "mastercard", name: "Mastercard", category: "credit-card", aliases: ["mastercard", "master"] },
  { slug: "jcb", name: "JCB Card", category: "credit-card", aliases: ["jcb"] },
  { slug: "kredivo", name: "Kredivo", category: "credit-card", aliases: ["kredivo"] },
  { slug: "akulaku", name: "Akulaku", category: "credit-card", aliases: ["akulaku"] },
];

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
];

export function getProviderBySlug(slug?: string | null): ProviderItem | undefined {
  if (!slug) return undefined;
  return PROVIDER_CATALOG.find((p) => p.slug.toLowerCase() === slug.toLowerCase());
}

export function getInitials(name?: string | null): string {
  if (!name) return "W";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function resolveProviderSlug(
  providerName?: string | null,
  providerSlug?: string | null
): string | null {
  if (providerSlug && providerSlug.trim()) {
    return providerSlug.trim();
  }
  if (!providerName || !providerName.trim()) {
    return null;
  }
  const cleanName = providerName.trim().toLowerCase();
  const match = PROVIDER_CATALOG.find(
    (p) =>
      p.slug.toLowerCase() === cleanName ||
      p.name.toLowerCase() === cleanName ||
      p.aliases?.some((a) => a.toLowerCase() === cleanName)
  );
  return match ? match.slug : null;
}

export interface ProviderBrand {
  /** Card face colour. */
  color: string;
  /** Text/logo colour that reads on `color`. */
  ink: string;
}

const LIGHT_INK = "#FFFFFF";
const DARK_INK = "#1A1A1A";

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string) {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * White or near-black, whichever reads better on the brand colour. Mid-tone brands such as
 * GoPay cyan or SeaBank orange only reach WCAG AA with dark text.
 */
export function inkFor(color: string) {
  return contrast(color, LIGHT_INK) >= contrast(color, DARK_INK) ? LIGHT_INK : DARK_INK;
}

/** Approximate brand colours for wallet cards. Unknown providers fall back to ivory + mint. */
const PROVIDER_COLORS: Record<string, { color: string }> = {
  bca: { color: "#005EB8" },
  mandiri: { color: "#003D79" },
  bni: { color: "#006A70" },
  bri: { color: "#00529C" },
  bsi: { color: "#00A39D" },
  jago: { color: "#FDB813" },
  seabank: { color: "#FF5C00" },
  "blu-by-bca-digital": { color: "#00A3E0" },
  jenius: { color: "#00AEEF" },
  permata: { color: "#007A3D" },
  cimb: { color: "#7A0019" },
  danamon: { color: "#F37021" },
  btn: { color: "#0057A8" },
  "bank-bjb": { color: "#005BAA" },
  "bank-neo-commerce": { color: "#FFD100" },
  allo: { color: "#E31E52" },
  panin: { color: "#003B71" },
  ocbc: { color: "#E3001B" },
  "maybank-indonesia": { color: "#FFC72C" },
  dbs: { color: "#E21C21" },
  gopay: { color: "#00AED6" },
  ovo: { color: "#4C2A86" },
  dana: { color: "#118EEA" },
  shopeepay: { color: "#EE4D2D" },
  linkaja: { color: "#E82127" },
  "astra-pay": { color: "#0057B8" },
  visa: { color: "#1A1F71" },
  mastercard: { color: "#252525" },
  jcb: { color: "#0E4C96" },
  kredivo: { color: "#FF6D00" },
  akulaku: { color: "#E8312F" },
};

export const FALLBACK_BRAND: ProviderBrand = { color: "#F4EEE0", ink: DARK_INK };

/** Brand colours for a wallet's provider, resolved from its slug or display name. */
export function providerBrand(providerName?: string | null, providerSlug?: string | null): ProviderBrand {
  const slug = resolveProviderSlug(providerName, providerSlug);
  const brand = slug ? PROVIDER_COLORS[slug.toLowerCase()] : undefined;
  return brand ? { color: brand.color, ink: inkFor(brand.color) } : FALLBACK_BRAND;
}
