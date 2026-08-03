import os
import re

base_path = r"D:\Source Code\zero-friction-erp\frontend\src"

# 1. Create route-metadata.ts
route_metadata_path = os.path.join(base_path, "lib", "route-metadata.ts")
route_metadata_content = """export type RouteMeta = {
  id: string;
  code: string;
  eyebrow: string;
  title: string;
  description: string;
};

const routeMap: Record<string, RouteMeta> = {
  "/": { id: "ringkasan", code: "RGS", eyebrow: "Ikhtisar", title: "Ringkasan", description: "Ringkasan keuangan Anda." },
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

export function getRouteMetadata(pathname: string): RouteMeta | undefined {
  return routeMap[pathname];
}
"""
os.makedirs(os.path.dirname(route_metadata_path), exist_ok=True)
with open(route_metadata_path, "w", encoding="utf-8") as f:
    f.write(route_metadata_content)

# 2. Create mobile-header.tsx
mobile_header_path = os.path.join(base_path, "components", "ui", "mobile-header.tsx")
mobile_header_content = """"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { getRouteMetadata } from "@/lib/route-metadata";

export function MobileAppHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const metadata = getRouteMetadata(pathname);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 md:hidden h-[calc(48px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center">
        {children}
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{metadata?.code || "ERP"}</span>
        <span className="text-sm font-semibold text-foreground leading-tight">{metadata?.title || "Zero-Friction"}</span>
      </div>

      <div className="flex items-center justify-end">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted focus:outline-none">
              <Plus className="h-5 w-5" />
              <span className="sr-only">Tambah</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="z-50 min-w-[220px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2">
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted focus:text-foreground">
                <Link href="/transactions?type=expense">Catat pengeluaran</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted focus:text-foreground">
                <Link href="/transactions?type=income">Catat pemasukan</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted focus:text-foreground">
                <Link href="/wallets?action=transfer">Transfer antar-dompet</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted focus:text-foreground">
                <Link href="/inbox?action=upload">Unggah/ekstrak bukti</Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
"""
os.makedirs(os.path.dirname(mobile_header_path), exist_ok=True)
with open(mobile_header_path, "w", encoding="utf-8") as f:
    f.write(mobile_header_content)

# 3. Create mobile-page-header.tsx
mobile_page_header_path = os.path.join(base_path, "components", "ui", "mobile-page-header.tsx")
mobile_page_header_content = """"use client";

import { usePathname } from "next/navigation";
import { getRouteMetadata } from "@/lib/route-metadata";

export function MobilePageHeader() {
  const pathname = usePathname();
  const metadata = getRouteMetadata(pathname);

  if (!metadata) return null;

  return (
    <div className="md:hidden flex flex-col gap-0.5 mb-4 px-1">
      <p className="eyebrow text-muted-foreground">{metadata.eyebrow}</p>
      <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
        {metadata.title}
      </h1>
      <p className="text-sm text-muted-foreground truncate">{metadata.description}</p>
    </div>
  );
}
"""
with open(mobile_page_header_path, "w", encoding="utf-8") as f:
    f.write(mobile_page_header_content)

# 4. Update layout.tsx
layout_path = os.path.join(base_path, "app", "(dashboard)", "layout.tsx")
with open(layout_path, "r", encoding="utf-8") as f:
    layout_content = f.read()

if "import { MobileAppHeader }" not in layout_content:
    layout_content = layout_content.replace(
        'import { MobileNavTrigger, SessionNavBar } from "@/components/ui/sidebar";',
        'import { MobileNavTrigger, SessionNavBar } from "@/components/ui/sidebar";\nimport { MobileAppHeader } from "@/components/ui/mobile-header";'
    )
    
old_header = """<header className="flex h-[54px] items-center border-b border-border bg-background px-3 md:hidden">
          <MobileNavTrigger onClick={() => setMobileNavOpen(true)} ref={mobileNavTriggerRef} />
          <p className="ml-2 text-sm font-semibold text-foreground">Zero-Friction ERP</p>
        </header>"""
new_header = """<MobileAppHeader>
          <MobileNavTrigger onClick={() => setMobileNavOpen(true)} ref={mobileNavTriggerRef} />
        </MobileAppHeader>"""
layout_content = layout_content.replace(old_header, new_header)

with open(layout_path, "w", encoding="utf-8") as f:
    f.write(layout_content)

# 5. Update page.tsx files
dashboard_path = os.path.join(base_path, "app", "(dashboard)")
pages_to_update = [
    os.path.join(dashboard_path, "page.tsx"),
    os.path.join(dashboard_path, "inbox", "page.tsx"),
    os.path.join(dashboard_path, "transactions", "page.tsx"),
    os.path.join(dashboard_path, "analytics", "page.tsx"),
    os.path.join(dashboard_path, "wallets", "page.tsx"),
    os.path.join(dashboard_path, "budgets", "page.tsx"),
    os.path.join(dashboard_path, "reimbursements", "page.tsx"),
    os.path.join(dashboard_path, "planning", "page.tsx"),
    os.path.join(dashboard_path, "taxonomy", "page.tsx"),
    os.path.join(dashboard_path, "recurring", "page.tsx"),
    os.path.join(dashboard_path, "guide", "page.tsx"),
    os.path.join(dashboard_path, "settings", "page.tsx"),
]

for page_path in pages_to_update:
    if not os.path.exists(page_path):
        continue
    with open(page_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "MobilePageHeader" not in content:
        # insert import
        import_stmt = 'import { MobilePageHeader } from "@/components/ui/mobile-page-header";\n'
        last_import_idx = content.rfind("import ")
        if last_import_idx != -1:
            end_of_last_import = content.find(";", last_import_idx)
            if end_of_last_import != -1:
                content = content[:end_of_last_import+1] + "\n" + import_stmt + content[end_of_last_import+1:]
        
        # replace the opening div tag
        content = re.sub(
            r'(<div className="[^"]*min-h-screen[^"]*">)',
            r'\1\n      <MobilePageHeader />',
            content
        )
        with open(page_path, "w", encoding="utf-8") as f:
            f.write(content)

print("Task A completed.")
