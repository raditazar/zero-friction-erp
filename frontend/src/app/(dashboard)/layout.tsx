"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MobileNavTrigger, SessionNavBar } from "@/components/ui/sidebar";
import { api, type Me } from "@/lib/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [readyStatus, setReadyStatus] = useState("ok");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    api.me().then(setMe).catch(console.error);
    api.ready().then((h) => setReadyStatus(h.status)).catch(() => setReadyStatus("tidak tersedia"));
  }, []);

  async function handleLogout() {
    setLogoutBusy(true);
    setLogoutError("");
    try {
      await api.logout();
      router.replace("/");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Tidak dapat keluar saat ini.");
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5]">
      <SessionNavBar
        isCollapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onCollapsedChange={setSidebarCollapsed}
        onMobileOpenChange={setMobileNavOpen}
        returnFocusRef={mobileNavTriggerRef}
        profileName={me?.profile?.full_name || me?.email || "Manajer Keuangan"}
        profileEmail={me?.email || "user@workspace.local"}
        readyStatus={readyStatus}
        busy={logoutBusy}
        onLogout={() => void handleLogout()}
      />
      <main className={`min-h-screen transition-[padding] duration-200 ${sidebarCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="flex h-[54px] items-center border-b border-border bg-background px-3 md:hidden">
          <MobileNavTrigger onClick={() => setMobileNavOpen(true)} ref={mobileNavTriggerRef} />
          <p className="ml-2 text-sm font-semibold text-foreground">Zero-Friction ERP</p>
        </header>
        {logoutError ? <p role="alert" className="border-b border-[#E6C8BE] bg-[#FAE8E3] px-5 py-3 text-sm text-[#7A2E1D]">{logoutError}</p> : null}
        {children}
      </main>
    </div>
  );
}
