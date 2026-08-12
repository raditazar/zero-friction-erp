"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRightLeft, BarChart3, BookOpen, ChevronUp, ClipboardCheck, CreditCard, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PiggyBank, ReceiptText, Repeat2, Settings as SettingsIcon, Tags, User, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type SidebarNavItem = { id: string; label: string; href?: string; icon: LucideIcon; badge?: string };
export type SidebarNavSection = { label: string; items: SidebarNavItem[] };
export type SessionNavBarProps = { activeItemId?: string; busy?: boolean; className?: string; isCollapsed?: boolean; items?: SidebarNavSection[]; mobileOpen?: boolean; onCollapsedChange?: (collapsed: boolean) => void; onItemSelect?: (id: string) => void; onLogout?: () => void; onMobileOpenChange?: (open: boolean) => void; organizationName?: string; profileEmail?: string; profileName?: string; readyStatus?: string; returnFocusRef?: RefObject<HTMLButtonElement | null> };

const defaultSections: SidebarNavSection[] = [
  { label: "Ringkasan & Inti", items: [{ id: "dashboard", label: "Ringkasan", href: "/", icon: LayoutDashboard }, { id: "review", label: "Kotak Masuk", href: "/inbox", icon: ClipboardCheck, badge: "Antrean" }, { id: "transactions", label: "Buku Besar", href: "/transactions", icon: ReceiptText }, { id: "analytics", label: "Laporan", href: "/analytics", icon: BarChart3 }] },
  { label: "Kelola Keuangan", items: [{ id: "wallets", label: "Dompet", href: "/wallets", icon: WalletCards }, { id: "budgets", label: "Anggaran", href: "/budgets", icon: PiggyBank }, { id: "reimbursements", label: "Reimburse", href: "/reimbursements", icon: ArrowRightLeft }, { id: "planning", label: "Target", href: "/planning", icon: CreditCard }] },
  { label: "Otomatisasi & Master", items: [{ id: "webhook", label: "Webhook", href: "/automation", icon: Activity }, { id: "taxonomy", label: "Kategori", href: "/taxonomy", icon: Tags }, { id: "recurring", label: "Berulang", href: "/recurring", icon: Repeat2 }] },
];

const mobileSections: SidebarNavSection[] = [
  { label: "Utama", items: [{ id: "dashboard", label: "Ringkasan", href: "/", icon: LayoutDashboard }, { id: "review", label: "Kotak Masuk", href: "/inbox", icon: ClipboardCheck, badge: "Antrean" }, { id: "transactions", label: "Buku Besar", href: "/transactions", icon: ReceiptText }, { id: "wallets", label: "Dompet", href: "/wallets", icon: WalletCards }, { id: "budgets", label: "Anggaran", href: "/budgets", icon: PiggyBank }, { id: "planning", label: "Target", href: "/planning", icon: CreditCard }] },
  { label: "Lainnya", items: [{ id: "analytics", label: "Laporan", href: "/analytics", icon: BarChart3 }, { id: "reimbursements", label: "Reimburse", href: "/reimbursements", icon: ArrowRightLeft }, { id: "webhook", label: "Webhook", href: "/automation", icon: Activity }, { id: "taxonomy", label: "Kategori", href: "/taxonomy", icon: Tags }, { id: "recurring", label: "Berulang", href: "/recurring", icon: Repeat2 }] },
];

function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }
function SidebarTooltip({ label, children }: { label: string; children: ReactNode }) { return <Tooltip.Root delayDuration={350}><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="right" sideOffset={10} className="sidebar-tooltip">{label}<Tooltip.Arrow className="fill-[var(--sidebar-charcoal)]" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>; }
type NavigationContentProps = Pick<SessionNavBarProps, "activeItemId" | "busy" | "items" | "onItemSelect" | "onLogout" | "organizationName" | "profileEmail" | "profileName" | "readyStatus"> & { collapsed: boolean; mobile?: boolean; onCloseMobile?: () => void; onToggleCollapsed?: () => void };

function NavigationContent({ activeItemId, busy = false, collapsed, items = defaultSections, mobile = false, onCloseMobile, onItemSelect, onLogout, onToggleCollapsed, organizationName = "satset ERP", profileEmail = "finance@workspace.local", profileName = "Operasional Keuangan" }: NavigationContentProps) {
  const pathname = usePathname();
  const iconOnly = collapsed && !mobile;
  const isActive = (item: SidebarNavItem) => activeItemId ? activeItemId === item.id : item.href === "/" ? pathname === "/" : !!item.href && (pathname === item.href || pathname?.startsWith(`${item.href}/`));
  const labelClass = cn("sidebar-item-label", collapsed && "sidebar-item-label-collapsed");
  const renderItem = (item: SidebarNavItem) => {
    const Icon = item.icon;
    const itemClass = cn("sidebar-nav-item", iconOnly && "sidebar-nav-item-collapsed", isActive(item) && "sidebar-nav-item-active");
    const content = <><Icon className="size-4 shrink-0" aria-hidden="true" /><span className={labelClass}>{item.label}</span>{!iconOnly && item.badge ? <Badge variant="outline" className="sidebar-nav-badge">{item.badge}</Badge> : null}</>;
    const onClick = () => { onItemSelect?.(item.id); onCloseMobile?.(); };
    const target = onItemSelect ? <button type="button" className={itemClass} aria-label={iconOnly ? item.label : undefined} onClick={onClick}>{content}</button> : <Link href={item.href ?? "#"} className={itemClass} aria-label={iconOnly ? item.label : undefined} onClick={onClick}>{content}</Link>;
    return iconOnly ? <SidebarTooltip key={item.id} label={item.label}>{target}</SidebarTooltip> : <span key={item.id}>{target}</span>;
  };
  const brandText = (
    <div className={cn("flex items-center gap-2.5 px-2 overflow-hidden", iconOnly && "justify-center px-0")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_square.png" alt="satset Logo" className="size-7 object-contain rounded-md shrink-0" />
      <span className={cn("font-extrabold text-base tracking-tight text-[var(--sidebar-charcoal)] truncate", iconOnly && "hidden")}>
        {organizationName}
      </span>
    </div>
  );
  const profileButton = <button type="button" className={cn("sidebar-profile-button", iconOnly && "sidebar-profile-button-collapsed")} aria-label={iconOnly ? `Profil ${profileName}` : undefined}><Avatar className="size-6 shrink-0"><AvatarFallback className="sidebar-avatar-fallback">{initials(profileName) || "OK"}</AvatarFallback></Avatar><span className={labelClass}><span className="block truncate text-sm font-semibold text-[var(--sidebar-charcoal)] text-left">{profileName}</span><span className="block truncate text-xs text-[var(--sidebar-ink-muted)] text-left">{profileEmail}</span></span>{!iconOnly ? <ChevronUp className="size-4 shrink-0 text-[var(--sidebar-ink-muted)]" aria-hidden="true" /> : null}</button>;
  const triggerElement = <DropdownMenu.Trigger asChild>{profileButton}</DropdownMenu.Trigger>;
  const profileDropdown = (
    <DropdownMenu.Root>
      {iconOnly ? <SidebarTooltip label={`Profil ${profileName}`}>{triggerElement}</SidebarTooltip> : triggerElement}
      <DropdownMenu.Portal>
        <DropdownMenu.Content side={iconOnly ? "right" : "top"} sideOffset={10} align={iconOnly ? "end" : "start"} className="z-50 min-w-[220px] rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-1.5 shadow-xl text-[#1A1A1A]">
          <DropdownMenu.Item asChild className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#1A1A1A] outline-none hover:bg-[#F4F3EE] focus:bg-[#F4F3EE] cursor-pointer transition-colors">
            <Link href="/settings?tab=profile" onClick={onCloseMobile}><User className="size-4 text-[#5A5A5A]" /><span>Profil Saya</span></Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#1A1A1A] outline-none hover:bg-[#F4F3EE] focus:bg-[#F4F3EE] cursor-pointer transition-colors">
            <Link href="/settings?tab=tokens-status" onClick={onCloseMobile}><SettingsIcon className="size-4 text-[#5A5A5A]" /><span>Status Sistem &amp; Integrasi</span></Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#1A1A1A] outline-none hover:bg-[#F4F3EE] focus:bg-[#F4F3EE] cursor-pointer transition-colors">
            <Link href="/settings?tab=guide" onClick={onCloseMobile}><BookOpen className="size-4 text-[#5A5A5A]" /><span>Panduan Pengguna</span></Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[#E8E6E1]" />
          <DropdownMenu.Item className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#DC2626] outline-none hover:bg-[#FEF2F2] focus:bg-[#FEF2F2] cursor-pointer transition-colors" onSelect={(e) => { e.preventDefault(); onLogout?.(); }} disabled={busy || !onLogout}>
            <LogOut className="size-4 text-[#DC2626]" /><span>{busy ? "Keluar…" : "Keluar / Logout"}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
  const topbarContent = (
    <div className={cn("sidebar-topbar", iconOnly ? "justify-center px-0" : "justify-between px-2")}>
      {!iconOnly ? brandText : null}
      {mobile ? (
        <Button variant="ghost" size="icon" className="sidebar-icon-control" onClick={onCloseMobile} aria-label="Tutup navigasi">
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <SidebarTooltip label={collapsed ? "Lebarkan navigasi" : "Ciutkan navigasi"}>
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-icon-control h-9 w-9 shrink-0 flex items-center justify-center rounded-lg"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Lebarkan navigasi" : "Ciutkan navigasi"}
          >
            {collapsed ? <PanelLeftOpen className="size-5 text-[var(--sidebar-charcoal)]" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          </Button>
        </SidebarTooltip>
      )}
    </div>
  );
  return (
    <div className="sidebar-content">
      {topbarContent}
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1 px-2 py-3">
          <nav aria-label="Navigasi utama" className="grid gap-2 pb-2">
            {items.map((section, index) => (
              <div key={section.label} className="grid gap-0.5">
                {!iconOnly ? (
                  <p className="sidebar-section-label">{section.label}</p>
                ) : index > 0 ? (
                  <Separator className="sidebar-section-separator" />
                ) : null}
                {section.items.map(renderItem)}
              </div>
            ))}
          </nav>
        </ScrollArea>
        <div className="sidebar-profile-area">{profileDropdown}</div>
      </div>
    </div>
  );
}

function MobileDeckContent(props: NavigationContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const deckHeight = isExpanded ? "92dvh" : "68dvh";
  return (
    <Dialog.Content 
      className="sidebar-shell fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[1.5rem] border-t shadow-xl outline-none md:hidden transition-[height] duration-200 ease-out motion-reduce:transition-none"
      style={{ height: deckHeight, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <Dialog.Title className="sr-only">Navigasi Utama (Command Deck)</Dialog.Title>
      <Dialog.Description className="sr-only">Menu navigasi aplikasi</Dialog.Description>
      <div className="flex w-full shrink-0 items-center justify-center pt-1 pb-1">
        <button 
          type="button" 
          className="flex h-11 min-h-[44px] w-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-charcoal)] focus-visible:bg-[var(--sidebar-oat)] rounded-t-[1.5rem]" 
          aria-label={isExpanded ? "Ciutkan navigasi" : "Lebarkan navigasi"} 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="h-1.5 w-12 rounded-full bg-[var(--sidebar-border)]" />
        </button>
      </div>
      <NavigationContent {...props} items={mobileSections} />
    </Dialog.Content>
  );
}

export const MobileNavTrigger = ({ onClick, ref }: { onClick: () => void; ref?: RefObject<HTMLButtonElement | null> }) => <Button ref={ref} variant="ghost" size="icon" className="sidebar-mobile-trigger md:hidden min-h-[44px] min-w-[44px]" onClick={onClick} aria-label="Buka navigasi"><Menu className="size-5" aria-hidden="true" /></Button>;

export function SessionNavBar({ className, isCollapsed: controlledCollapsed, mobileOpen = false, onCollapsedChange, onMobileOpenChange, returnFocusRef, ...props }: SessionNavBarProps) {
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? uncontrolledCollapsed;
  const setCollapsed = (next: boolean) => { setUncontrolledCollapsed(next); onCollapsedChange?.(next); };
  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = returnFocusRef?.current;
    return () => trigger?.focus();
  }, [mobileOpen, returnFocusRef]);
  return <Tooltip.Provider delayDuration={350}><aside className={cn("sidebar-shell fixed inset-y-0 left-0 z-40 hidden border-r transition-[width] md:flex", collapsed ? "w-16" : "w-60", className)}><NavigationContent {...props} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} /></aside><Dialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] md:hidden" /><MobileDeckContent {...props} collapsed={false} mobile onCloseMobile={() => onMobileOpenChange?.(false)} /></Dialog.Portal></Dialog.Root></Tooltip.Provider>;
}
