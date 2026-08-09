"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MobileNavTrigger, SessionNavBar } from "@/components/ui/sidebar";
import { MobileAppHeader } from "@/components/ui/mobile-header";
import { api, type Me } from "@/lib/api";
import { HelpDialog, type ShortcutItem } from "@/components/ui/dialogs/help-dialog";

const GLOBAL_SHORTCUTS: ShortcutItem[] = [
  { id: "s1", title: "Buka Bantuan", category: "Umum", keys: ["Cmd", "/"], description: "Menampilkan dialog panduan pintasan" },
  { id: "s2", title: "Pencarian Global", category: "Navigasi", keys: ["Cmd", "K"], description: "Mencari transaksi, dompet, atau tagihan" },
  { id: "s3", title: "Tutup Dialog", category: "Umum", keys: ["Esc"], description: "Menutup modal atau menu yang aktif" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [readyStatus, setReadyStatus] = useState("ok");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    api.me()
       .then(setMe)
       .catch((err) => {
         console.error(err);
         router.replace("/login");
       });
    api.ready().then((h) => setReadyStatus(h.status)).catch(() => setReadyStatus("tidak tersedia"));
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
        return;
      }
      
      const isQuestionMark = e.key === "?";
      const isCmdSlash = (e.metaKey || e.ctrlKey) && e.key === "/";
      
      if (isQuestionMark || isCmdSlash) {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
    <div className="min-h-screen bg-[#F4F3EE]">
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
        <MobileAppHeader>
          <MobileNavTrigger onClick={() => setMobileNavOpen(true)} ref={mobileNavTriggerRef} />
        </MobileAppHeader>
        {logoutError ? <p role="alert" className="border-b border-[#E6C8BE] bg-[#FAE8E3] px-5 py-3 text-sm text-[#7A2E1D]">{logoutError}</p> : null}
        {children}
      </main>
      <HelpDialog 
        open={helpOpen} 
        onOpenChange={setHelpOpen} 
        shortcuts={GLOBAL_SHORTCUTS} 
        enableGlobalShortcut={false} 
      />
    </div>
  );
}
