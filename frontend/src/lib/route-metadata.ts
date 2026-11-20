export type RouteMeta = {
  id: string;
  eyebrow: string;
  /** Same wording as the navigation label. */
  title: string;
  description: string;
  /**
   * Position in the mobile dock (0 Beranda, 1 Buku Besar, 3 Kotak Masuk). Pages reached through
   * "Lainnya" share slot 4 and show a back button. Also drives page-transition direction.
   */
  dockSlot: number;
  primaryCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

export const MORE_SLOT = 4;

const routeMap: Record<string, RouteMeta> = {
  "/": { id: "home", eyebrow: "Ikhtisar", title: "Beranda", description: "Ringkasan keuangan Anda.", dockSlot: 0 },
  "/transactions": { id: "transactions", eyebrow: "Operasional", title: "Buku Besar", description: "Pencatatan pemasukan dan pengeluaran.", dockSlot: 1 },
  "/inbox": { id: "inbox", eyebrow: "Operasional", title: "Kotak Masuk", description: "Transaksi yang menunggu persetujuan.", dockSlot: 3 },
  "/wallets": { id: "wallets", eyebrow: "Keuangan", title: "Dompet", description: "Saldo dan rekening.", dockSlot: MORE_SLOT },
  "/budgets": { id: "budgets", eyebrow: "Keuangan", title: "Anggaran", description: "Rencana dan batas belanja bulanan.", dockSlot: MORE_SLOT },
  "/analytics": { id: "analytics", eyebrow: "Laporan", title: "Analitik", description: "Tren dan rincian keuangan.", dockSlot: MORE_SLOT },
  "/planning": { id: "planning", eyebrow: "Keuangan", title: "Target", description: "Tabungan dan dana tujuan.", dockSlot: MORE_SLOT },
  "/recurring": { id: "recurring", eyebrow: "Keuangan", title: "Berulang", description: "Transaksi yang terjadwal.", dockSlot: MORE_SLOT },
  "/reimbursements": { id: "reimbursements", eyebrow: "Operasional", title: "Reimburse", description: "Klaim dan penggantian biaya.", dockSlot: MORE_SLOT },
  "/taxonomy": { id: "taxonomy", eyebrow: "Pengaturan", title: "Kategori", description: "Kategori dan label transaksi.", dockSlot: MORE_SLOT },
  "/automation": { id: "automation", eyebrow: "Pengaturan", title: "Otomasi", description: "Webhook dan antrean kejadian.", dockSlot: MORE_SLOT },
  "/guide": { id: "guide", eyebrow: "Bantuan", title: "Panduan", description: "Panduan penggunaan aplikasi.", dockSlot: MORE_SLOT },
  "/settings": { id: "settings", eyebrow: "Pengaturan", title: "Pengaturan", description: "Profil, tema, dan integrasi.", dockSlot: MORE_SLOT },
};

function normalize(pathname: string | null | undefined) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/$/, "");
}

export function getRouteMetadata(pathname: string | null | undefined): RouteMeta | undefined {
  const path = normalize(pathname);
  if (routeMap[path]) return routeMap[path];
  // Nested routes inherit from their first segment.
  return routeMap[`/${path.split("/")[1] ?? ""}`];
}

export function getDockSlot(pathname: string | null | undefined) {
  return getRouteMetadata(pathname)?.dockSlot ?? MORE_SLOT;
}
