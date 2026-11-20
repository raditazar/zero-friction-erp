"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SessionNavBar } from "@/components/ui/sidebar";
import { MobileAppHeader } from "@/components/ui/mobile-header";
import { MobileDock } from "@/components/ui/mobile-dock";
import { MoreSheet } from "@/components/ui/more-sheet";
import { IosInstallBanner } from "@/components/ui/ios-install-banner";
import { CaptureSheet, type CaptureMode } from "@/components/dashboard/CaptureSheet";
import { useCaptureRequests } from "@/lib/capture-bus";
import { api, type Me } from "@/lib/api";
import { HelpDialog, type ShortcutItem } from "@/components/ui/dialogs/help-dialog";
import { toast } from "@/components/ui/toast";
import { setFormatPrefs } from "@/components/dashboard/formatters";
import { AppSWRConfig, revalidateFinance, useAppBadge, useInbox } from "@/lib/swr";

const GLOBAL_SHORTCUTS: ShortcutItem[] = [
  { id: "s1", title: "Buka Bantuan", category: "Umum", keys: ["Cmd", "/"], description: "Menampilkan dialog panduan pintasan" },
  { id: "s2", title: "Pencarian Global", category: "Navigasi", keys: ["Cmd", "K"], description: "Mencari transaksi, dompet, atau tagihan" },
  { id: "s3", title: "Tutup Dialog", category: "Umum", keys: ["Esc"], description: "Menutup modal atau menu yang aktif" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppSWRConfig>
      <DashboardShell>{children}</DashboardShell>
    </AppSWRConfig>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [readyStatus, setReadyStatus] = useState("ok");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode | undefined>(undefined);
  useCaptureRequests((mode) => {
    setCaptureMode(mode);
    setCaptureOpen(true);
  });
  const { data: inboxItems } = useInbox();
  const pendingInboxCount = inboxItems?.length ?? 0;
  useAppBadge(pendingInboxCount);

  const router = useRouter();

  useEffect(() => {
    api.me()
       .then((profile) => {
         setFormatPrefs(profile.profile ?? {});
         setMe(profile);
       })
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

  const profileName = me?.profile?.full_name || me?.email || "Manajer Keuangan";
  const profileEmail = me?.email || "user@workspace.local";

  return (
    <div className="min-h-dvh bg-paper">
      <SessionNavBar
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        profileName={profileName}
        profileEmail={profileEmail}
        readyStatus={readyStatus}
        busy={logoutBusy}
        onLogout={() => void handleLogout()}
      />
      <main className={`min-h-dvh bg-paper transition-[padding] duration-200 overflow-x-clip pb-[var(--dock-space)] md:pb-6 ${sidebarCollapsed ? "md:pl-16" : "md:pl-60"}`}>
        <MobileAppHeader />

        {/* Safari iOS PWA install guidance banner */}
        <IosInstallBanner />

        {logoutError ? <p role="alert" className="border-b border-negative-line bg-negative-soft px-5 py-3 text-sm text-negative">{logoutError}</p> : null}
        {children}
      </main>

      <MobileDock
        pendingCount={pendingInboxCount}
        moreOpen={moreOpen}
        onCapture={() => {
          setCaptureMode(undefined);
          setCaptureOpen(true);
        }}
        onMore={() => setMoreOpen(true)}
      />

      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        profileName={profileName}
        profileEmail={profileEmail}
        logoutBusy={logoutBusy}
        onLogout={() => void handleLogout()}
      />

      <CaptureSheet
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        initialMode={captureMode}
        onSuccess={() => {
          void revalidateFinance();
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
