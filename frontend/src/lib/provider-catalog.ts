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
