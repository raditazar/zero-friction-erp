"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRightLeft, BarChart3, Bot, ClipboardCheck, CreditCard, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PiggyBank, PlugZap, ReceiptText, Repeat2, Settings, Tags, WalletCards, X } from "lucide-react";
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
  { label: "Otomatisasi & Master", items: [{ id: "integrations", label: "Integrasi", href: "/integrations", icon: PlugZap }, { id: "webhook", label: "Webhook", href: "/automation", icon: Activity }, { id: "taxonomy", label: "Kategori", href: "/taxonomy", icon: Tags }, { id: "recurring", label: "Berulang", href: "/recurring", icon: Repeat2 }] },
  { label: "Bantuan & Sistem", items: [{ id: "guide", label: "Panduan", href: "/guide", icon: Bot, badge: "Bantuan" }, { id: "settings", label: "Pengaturan", href: "/settings", icon: Settings }] },
];

const mobileSections: SidebarNavSection[] = [
  { label: "Utama", items: [{ id: "dashboard", label: "Ringkasan", href: "/", icon: LayoutDashboard }, { id: "review", label: "Kotak Masuk", href: "/inbox", icon: ClipboardCheck, badge: "Antrean" }, { id: "transactions", label: "Buku Besar", href: "/transactions", icon: ReceiptText }, { id: "wallets", label: "Dompet", href: "/wallets", icon: WalletCards }, { id: "budgets", label: "Anggaran", href: "/budgets", icon: PiggyBank }, { id: "planning", label: "Target", href: "/planning", icon: CreditCard }] },
  { label: "Lainnya", items: [{ id: "analytics", label: "Laporan", href: "/analytics", icon: BarChart3 }, { id: "reimbursements", label: "Reimburse", href: "/reimbursements", icon: ArrowRightLeft }, { id: "integrations", label: "Integrasi", href: "/integrations", icon: PlugZap }, { id: "webhook", label: "Webhook", href: "/automation", icon: Activity }, { id: "taxonomy", label: "Kategori", href: "/taxonomy", icon: Tags }, { id: "recurring", label: "Berulang", href: "/recurring", icon: Repeat2 }, { id: "guide", label: "Panduan", href: "/guide", icon: Bot, badge: "Bantuan" }, { id: "settings", label: "Pengaturan", href: "/settings", icon: Settings }] },
];

function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }
function SidebarTooltip({ label, children }: { label: string; children: ReactNode }) { return <Tooltip.Root delayDuration={350}><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="right" sideOffset={10} className="sidebar-tooltip">{label}<Tooltip.Arrow className="fill-[var(--sidebar-charcoal)]" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>; }
type NavigationContentProps = Pick<SessionNavBarProps, "activeItemId" | "busy" | "items" | "onItemSelect" | "onLogout" | "organizationName" | "profileEmail" | "profileName" | "readyStatus"> & { collapsed: boolean; mobile?: boolean; onCloseMobile?: () => void; onToggleCollapsed?: () => void };

function NavigationContent({ activeItemId, busy = false, collapsed, items = defaultSections, mobile = false, onCloseMobile, onItemSelect, onLogout, onToggleCollapsed, organizationName = "Zero-Friction ERP", profileEmail = "finance@workspace.local", profileName = "Operasional Keuangan" }: NavigationContentProps) {
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
  const brandText = <div className={cn("flex-1 px-2 font-bold text-[var(--sidebar-charcoal)] truncate", iconOnly && "hidden")}>{organizationName}</div>;
  const profileButton = <button type="button" className={cn("sidebar-profile-button", iconOnly && "sidebar-profile-button-collapsed")} onClick={onLogout} disabled={busy || !onLogout} aria-label={iconOnly ? `Keluar sebagai ${profileName}` : undefined}><Avatar className="size-6 shrink-0"><AvatarFallback className="sidebar-avatar-fallback">{initials(profileName) || "OK"}</AvatarFallback></Avatar><span className={labelClass}><span className="block truncate text-sm font-semibold text-[var(--sidebar-charcoal)] text-left">{busy ? "Keluar…" : profileName}</span><span className="block truncate text-xs text-[var(--sidebar-ink-muted)] text-left">{profileEmail}</span></span>{!iconOnly ? <LogOut className="size-4 shrink-0 text-[var(--sidebar-ink-muted)]" aria-hidden="true" /> : null}</button>;
  return <div className="sidebar-content"><div className="sidebar-topbar">{brandText}{mobile ? <Button variant="ghost" size="icon" className="sidebar-icon-control" onClick={onCloseMobile} aria-label="Tutup navigasi"><X className="size-4" aria-hidden="true" /></Button> : <Button variant="ghost" size="icon" className={cn("sidebar-icon-control", iconOnly && "sidebar-icon-control-collapsed")} onClick={onToggleCollapsed} aria-label={collapsed ? "Lebarkan navigasi" : "Ciutkan navigasi"}>{collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}</Button>}</div><div className="flex min-h-0 flex-1 flex-col"><ScrollArea className="min-h-0 flex-1 px-2 py-3"><nav aria-label="Navigasi utama" className="grid gap-2 pb-2">{items.map((section, index) => <div key={section.label} className="grid gap-0.5">{!iconOnly ? <p className="sidebar-section-label">{section.label}</p> : index > 0 ? <Separator className="sidebar-section-separator" /> : null}{section.items.map(renderItem)}</div>)}</nav></ScrollArea><div className="sidebar-profile-area">{iconOnly ? <SidebarTooltip label={`Keluar sebagai ${profileName}`}>{profileButton}</SidebarTooltip> : profileButton}</div></div></div>;
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
      <div className="flex w-full shrink-0 items-center justify-center pt-1 pb-1">
        <button 
          type="button" 
          className="flex h-10 w-full items-center justify-center outline-none focus-visible:bg-[var(--sidebar-oat)] rounded-t-[1.5rem]" 
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

export const MobileNavTrigger = ({ onClick, ref }: { onClick: () => void; ref?: RefObject<HTMLButtonElement | null> }) => <Button ref={ref} variant="ghost" size="icon" className="sidebar-mobile-trigger md:hidden" onClick={onClick} aria-label="Buka navigasi"><Menu className="size-5" aria-hidden="true" /></Button>;

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
