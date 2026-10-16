"use client";

import { usePathname } from "next/navigation";
import { getRouteMetadata } from "@/lib/route-metadata";

export function MobileAppHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const metadata = getRouteMetadata(pathname);

  return (
    <header 
      className="sticky top-0 z-40 flex items-center justify-between border-b border-[#E0DDD6] bg-[#FFFFFF] px-3 md:hidden"
      style={{ height: "calc(48px + env(safe-area-inset-top, 0px))", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex items-center shrink-0">
        {children}
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1 min-w-0 px-2">
        <span className="text-[10px] font-bold text-[#756f64] uppercase tracking-wider">{metadata?.code || "ERP"}</span>
        <span className="text-sm font-semibold text-[#1A1A1A] leading-tight truncate">{metadata?.title || "satset"}</span>
      </div>

      {/* Balanced spacer for clean header symmetry */}
      <div className="w-11 h-11 shrink-0" aria-hidden="true" />
    </header>
  );
}
