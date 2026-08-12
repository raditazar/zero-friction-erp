export type RouteMeta = {
  id: string;
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

const routeMap: Record<string, RouteMeta> = {
  "/": { id: "ringkasan", code: "RGS", eyebrow: "Ikhtisar", title: "Ringkasan", description: "Ringkasan keuangan Anda.", primaryCta: { label: "Catat Transaksi", href: "/transactions" } },
  "/inbox": { id: "inbox", code: "INB", eyebrow: "Operasional", title: "Inbox", description: "Manajemen dokumen dan bukti transaksi." },
  "/transactions": { id: "transactions", code: "TRX", eyebrow: "Operasional", title: "Transaksi", description: "Pencatatan pemasukan dan pengeluaran." },
  "/analytics": { id: "analytics", code: "ANL", eyebrow: "Laporan", title: "Analitik", description: "Analisis dan tren keuangan." },
  "/wallets": { id: "wallets", code: "WLT", eyebrow: "Keuangan", title: "Dompet", description: "Manajemen saldo dan rekening." },
  "/budgets": { id: "budgets", code: "BGT", eyebrow: "Keuangan", title: "Anggaran", description: "Perencanaan dan kontrol anggaran." },
  "/reimbursements": { id: "reimbursements", code: "RMB", eyebrow: "Operasional", title: "Reimbursement", description: "Klaim dan penggantian biaya." },
  "/planning": { id: "planning", code: "PLN", eyebrow: "Keuangan", title: "Perencanaan", description: "Perencanaan keuangan masa depan." },
  "/taxonomy": { id: "taxonomy", code: "TAX", eyebrow: "Pengaturan", title: "Taksonomi", description: "Kategori dan label transaksi." },
  "/recurring": { id: "recurring", code: "REC", eyebrow: "Keuangan", title: "Berulang", description: "Manajemen transaksi berulang." },
  "/guide": { id: "guide", code: "GUD", eyebrow: "Bantuan", title: "Panduan", description: "Panduan penggunaan aplikasi." },
  "/settings": { id: "settings", code: "SET", eyebrow: "Pengaturan", title: "Pengaturan", description: "Konfigurasi preferensi aplikasi." },
};

export function getRouteMetadata(pathname: string | null | undefined): RouteMeta | undefined {
  if (!pathname) return routeMap["/"];
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return routeMap[normalizedPath];
}

