"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MobileNavTrigger, SessionNavBar } from "@/components/ui/sidebar";
import { MobileAppHeader } from "@/components/ui/mobile-header";
import { MobileFloatingBar } from "@/components/ui/mobile-floating-bar";
import { IosInstallBanner } from "@/components/ui/ios-install-banner";
import { QuickCaptureDrawer } from "@/components/dashboard/QuickCaptureDrawer";
import { api, type Me } from "@/lib/api";
import { HelpDialog, type ShortcutItem } from "@/components/ui/dialogs/help-dialog";
import { toast } from "@/components/ui/toast";

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

  // Mobile PWA enhancements
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [pendingInboxCount, setPendingInboxCount] = useState(0);

  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  function refreshInboxCount() {
    api.inbox()
      .then((items) => setPendingInboxCount(items.length))
      .catch(() => {});
  }

  useEffect(() => {
    api.me()
       .then(setMe)
       .catch((err) => {
         console.error(err);
         router.replace("/login");
       });
    api.ready().then((h) => setReadyStatus(h.status)).catch(() => setReadyStatus("tidak tersedia"));
    refreshInboxCount();
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
      toast.success("Berhasil keluar dari akun.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Tidak dapat keluar saat ini.";
      setLogoutError(msg);
      toast.error("Gagal keluar dari akun", { detail: msg });
    } finally {
      setLogoutBusy(false);
    }
  }

  // Direct camera capture from floating bar
  function handleDirectCameraCapture(file: File) {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          const mimeType = file.type || "image/jpeg";
          const res = await api.extractTransaction({
            image_base64: base64Data,
            image_mime: mimeType,
          });
          const merchant = res.transaction?.merchant || "Struk Pembayaran";
          toast.success(`Foto struk berhasil diekstrak: ${merchant}`);
          refreshInboxCount();
          router.refresh();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Gagal mengekstrak foto struk.";
          toast.error("Ekstraksi gagal", { detail: msg });
        }
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membaca berkas kamera.";
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F3EE] overflow-x-hidden">
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
      <main className={`min-h-screen transition-[padding] duration-200 overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,16px))] md:pb-6 ${sidebarCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <MobileAppHeader>
          <MobileNavTrigger onClick={() => setMobileNavOpen(true)} ref={mobileNavTriggerRef} />
        </MobileAppHeader>
        
        {/* Safari iOS PWA install guidance banner */}
        <div className="pt-3">
          <IosInstallBanner />
        </div>

        {logoutError ? <p role="alert" className="border-b border-[#E6C8BE] bg-[#FAE8E3] px-5 py-3 text-sm text-[#7A2E1D]">{logoutError}</p> : null}
        {children}
      </main>

      {/* Floating Island Dock for Mobile PWA */}
      <MobileFloatingBar
        pendingCount={pendingInboxCount}
        onQuickAddClick={() => setQuickDrawerOpen(true)}
        onCameraCapture={handleDirectCameraCapture}
      />

      {/* Quick Capture Bottom Sheet Drawer */}
      <QuickCaptureDrawer
        open={quickDrawerOpen}
        onOpenChange={setQuickDrawerOpen}
        onSuccess={() => {
          refreshInboxCount();
          router.refresh();
        }}
      />

      <HelpDialog 
        open={helpOpen} 
        onOpenChange={setHelpOpen} 
        shortcuts={GLOBAL_SHORTCUTS} 
        enableGlobalShortcut={false} 
      />
    </div>
  );
}
