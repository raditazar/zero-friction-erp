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
  "/inbox": { id: "inbox", code: "INB", eyebrow: "Operasional", title: "Inbox", description: "Manajemen dokumen dan bukti transaksi.", primaryCta: { label: "Unggah Bukti", href: "/inbox?action=upload" } },
  "/transactions": { id: "transactions", code: "TRX", eyebrow: "Operasional", title: "Transaksi", description: "Pencatatan pemasukan dan pengeluaran.", primaryCta: { label: "Tambah Transaksi", href: "/transactions?action=new" } },
  "/analytics": { id: "analytics", code: "ANL", eyebrow: "Laporan", title: "Analitik", description: "Analisis dan tren keuangan.", primaryCta: { label: "Unduh Laporan", href: "/analytics" } },
  "/wallets": { id: "wallets", code: "WLT", eyebrow: "Keuangan", title: "Dompet", description: "Manajemen saldo dan rekening.", primaryCta: { label: "Tambah Dompet", href: "/wallets" } },
  "/budgets": { id: "budgets", code: "BGT", eyebrow: "Keuangan", title: "Anggaran", description: "Perencanaan dan kontrol anggaran.", primaryCta: { label: "Buat Anggaran", href: "/budgets" } },
  "/reimbursements": { id: "reimbursements", code: "RMB", eyebrow: "Operasional", title: "Reimbursement", description: "Klaim dan penggantian biaya.", primaryCta: { label: "Ajukan Klaim", href: "/reimbursements" } },
  "/planning": { id: "planning", code: "PLN", eyebrow: "Keuangan", title: "Perencanaan", description: "Perencanaan keuangan masa depan.", primaryCta: { label: "Tambah Target", href: "/planning" } },
  "/taxonomy": { id: "taxonomy", code: "TAX", eyebrow: "Pengaturan", title: "Taksonomi", description: "Kategori dan label transaksi.", primaryCta: { label: "Tambah Kategori", href: "/taxonomy" } },
  "/recurring": { id: "recurring", code: "REC", eyebrow: "Keuangan", title: "Berulang", description: "Manajemen transaksi berulang.", primaryCta: { label: "Tambah Jadwal", href: "/recurring" } },
  "/guide": { id: "guide", code: "GUD", eyebrow: "Bantuan", title: "Panduan", description: "Panduan penggunaan aplikasi.", primaryCta: { label: "Bantuan", href: "/guide" } },
  "/settings": { id: "settings", code: "SET", eyebrow: "Pengaturan", title: "Pengaturan", description: "Konfigurasi preferensi aplikasi.", primaryCta: { label: "Simpan Preferensi", href: "/settings" } },
};

export function getRouteMetadata(pathname: string | null | undefined): RouteMeta | undefined {
  if (!pathname) return routeMap["/"];
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return routeMap[normalizedPath];
}

