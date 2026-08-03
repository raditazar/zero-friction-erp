"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { getRouteMetadata } from "@/lib/route-metadata";

export function MobileAppHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const metadata = getRouteMetadata(pathname);

  return (
    <header 
      className="sticky top-0 z-40 flex items-center justify-between border-b border-[#E0DDD6] bg-[#FFFFFF] px-3 md:hidden"
      style={{ height: "calc(48px + env(safe-area-inset-top, 0px))", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center">
        {children}
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1">
        <span className="text-[10px] font-bold text-[#756f64] uppercase tracking-wider">{metadata?.code || "ERP"}</span>
        <span className="text-sm font-semibold text-[#1A1A1A] leading-tight">{metadata?.title || "Zero-Friction"}</span>
      </div>

      <div className="flex items-center justify-end">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-md text-[#1A1A1A] hover:bg-[#F0EEE9] focus:outline-none">
              <Plus className="h-5 w-5" />
              <span className="sr-only">Tambah</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="z-50 min-w-[220px] overflow-hidden rounded-md border border-[#E0DDD6] bg-[#FFFFFF] p-1 text-[#1A1A1A] shadow-md animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2">
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[#F0EEE9] focus:bg-[#F0EEE9] focus:text-[#1A1A1A]">
                <Link href="/transactions?type=expense">Catat pengeluaran</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[#F0EEE9] focus:bg-[#F0EEE9] focus:text-[#1A1A1A]">
                <Link href="/transactions?type=income">Catat pemasukan</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[#F0EEE9] focus:bg-[#F0EEE9] focus:text-[#1A1A1A]">
                <Link href="/wallets?action=transfer">Transfer antar-dompet</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[#F0EEE9] focus:bg-[#F0EEE9] focus:text-[#1A1A1A]">
                <Link href="/inbox?action=upload">Unggah/ekstrak bukti</Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
