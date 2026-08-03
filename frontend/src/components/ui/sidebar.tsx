"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, BarChart3, Bot, ChevronsUpDown, ClipboardCheck, CreditCard, DatabaseZap, Landmark, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PiggyBank, ReceiptText, Repeat2, Settings, Tags, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type SidebarNavItem = { id: string; label: string; href?: string; icon: LucideIcon; badge?: string };
export type SidebarNavSection = { label: string; items: SidebarNavItem[] };
export type SessionNavBarProps = { activeItemId?: string; busy?: boolean; className?: string; isCollapsed?: boolean; items?: SidebarNavSection[]; mobileOpen?: boolean; onCollapsedChange?: (collapsed: boolean) => void; onItemSelect?: (id: string) => void; onLogout?: () => void; onMobileOpenChange?: (open: boolean) => void; organizationName?: string; profileEmail?: string; profileName?: string; readyStatus?: string; returnFocusRef?: RefObject<HTMLButtonElement | null> };

const defaultSections: SidebarNavSection[] = [
  { label: "Ringkasan & Inti", items: [{ id: "dashboard", label: "Ringkasan", href: "/", icon: LayoutDashboard }, { id: "review", label: "Kotak Masuk", href: "/inbox", icon: ClipboardCheck, badge: "Antrean" }, { id: "transactions", label: "Buku Besar", href: "/transactions", icon: ReceiptText }, { id: "analytics", label: "Laporan & Tren", href: "/analytics", icon: BarChart3 }] },
  { label: "Kelola Keuangan", items: [{ id: "wallets", label: "Dompet & Transfer", href: "/wallets", icon: WalletCards }, { id: "budgets", label: "Anggaran Belanja", href: "/budgets", icon: PiggyBank }, { id: "reimbursements", label: "Piutang Reimburse", href: "/reimbursements", icon: ArrowRightLeft }, { id: "planning", label: "Target Tabungan", href: "/planning", icon: CreditCard }] },
  { label: "Otomatisasi & Master", items: [{ id: "taxonomy", label: "Kategori & Tag", href: "/taxonomy", icon: Tags }, { id: "recurring", label: "Tagihan Berulang", href: "/recurring", icon: Repeat2 }] },
  { label: "Bantuan & Sistem", items: [{ id: "guide", label: "Panduan Penggunaan", href: "/guide", icon: Bot, badge: "Bantuan" }, { id: "settings", label: "Pengaturan & Profil", href: "/settings", icon: Settings }] },
];

function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }
function SidebarTooltip({ label, children }: { label: string; children: ReactNode }) { return <Tooltip.Root delayDuration={350}><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="right" sideOffset={10} className="sidebar-tooltip">{label}<Tooltip.Arrow className="fill-[var(--sidebar-charcoal)]" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>; }
type NavigationContentProps = Pick<SessionNavBarProps, "activeItemId" | "busy" | "items" | "onItemSelect" | "onLogout" | "organizationName" | "profileEmail" | "profileName" | "readyStatus"> & { collapsed: boolean; mobile?: boolean; onCloseMobile?: () => void; onToggleCollapsed?: () => void };

function NavigationContent({ activeItemId, busy = false, collapsed, items = defaultSections, mobile = false, onCloseMobile, onItemSelect, onLogout, onToggleCollapsed, organizationName = "Zero-Friction ERP", profileEmail = "finance@workspace.local", profileName = "Operasional Keuangan", readyStatus = "memeriksa" }: NavigationContentProps) {
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
  const workspaceButton = <Button variant="ghost" size="sm" className={cn("sidebar-workspace-trigger", iconOnly && "sidebar-workspace-trigger-collapsed")} aria-label={iconOnly ? organizationName : undefined}><Avatar className="size-6 shrink-0 rounded-md"><AvatarFallback className="sidebar-brand-mark"><Landmark className="size-3.5" aria-hidden="true" /></AvatarFallback></Avatar><span className={labelClass}>{organizationName}</span>{!iconOnly ? <ChevronsUpDown className="size-4 shrink-0 opacity-55" aria-hidden="true" /> : null}</Button>;
  const workspaceMenu = <DropdownMenu modal={false}><DropdownMenuTrigger asChild>{workspaceButton}</DropdownMenuTrigger><DropdownMenuContent align="start" side="right" className="sidebar-dropdown w-60"><DropdownMenuItem className="sidebar-dropdown-item"><DatabaseZap className="size-4" /> Backend: {readyStatus}</DropdownMenuItem><DropdownMenuSeparator className="sidebar-dropdown-separator" /><DropdownMenuItem className="sidebar-dropdown-item"><CreditCard className="size-4" /> Ruang kerja keuangan</DropdownMenuItem><DropdownMenuItem className="sidebar-dropdown-item"><Settings className="size-4" /> Pengaturan ruang kerja</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
  const profileButton = <button type="button" className={cn("sidebar-profile-button", iconOnly && "sidebar-profile-button-collapsed")} onClick={onLogout} disabled={busy || !onLogout} aria-label={iconOnly ? `Keluar sebagai ${profileName}` : undefined}><Avatar className="size-6 shrink-0"><AvatarFallback className="sidebar-avatar-fallback">{initials(profileName) || "OK"}</AvatarFallback></Avatar><span className={labelClass}><span className="block truncate text-sm font-semibold text-[var(--sidebar-charcoal)]">{busy ? "Keluar…" : profileName}</span><span className="block truncate text-xs text-[var(--sidebar-ink-muted)]">{profileEmail}</span></span>{!iconOnly ? <LogOut className="size-4 shrink-0 text-[var(--sidebar-ink-muted)]" aria-hidden="true" /> : null}</button>;
  return <div className="sidebar-content"><div className="sidebar-topbar">{workspaceMenu}{mobile ? <Button variant="ghost" size="icon" className="sidebar-icon-control" onClick={onCloseMobile} aria-label="Tutup navigasi"><X className="size-4" aria-hidden="true" /></Button> : <Button variant="ghost" size="icon" className={cn("sidebar-icon-control", iconOnly && "sidebar-icon-control-collapsed")} onClick={onToggleCollapsed} aria-label={collapsed ? "Lebarkan navigasi" : "Ciutkan navigasi"}>{collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}</Button>}</div><div className="flex min-h-0 flex-1 flex-col"><ScrollArea className="min-h-0 flex-1 px-2 py-3"><nav aria-label="Navigasi utama" className="grid gap-4 pb-2">{items.map((section, index) => <div key={section.label} className="grid gap-1">{!iconOnly ? <p className="sidebar-section-label">{section.label}</p> : index > 0 ? <Separator className="sidebar-section-separator" /> : null}{section.items.map(renderItem)}</div>)}</nav></ScrollArea><div className="sidebar-profile-area">{iconOnly ? <SidebarTooltip label={`Keluar sebagai ${profileName}`}>{profileButton}</SidebarTooltip> : profileButton}</div></div></div>;
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
  return <Tooltip.Provider delayDuration={350}><aside className={cn("sidebar-shell fixed inset-y-0 left-0 z-40 hidden border-r transition-[width] md:flex", collapsed ? "w-16" : "w-60", className)}><NavigationContent {...props} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} /></aside><Dialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] md:hidden" /><Dialog.Content className="sidebar-shell fixed inset-y-0 left-0 z-50 w-[min(19rem,calc(100vw-2.5rem))] border-r shadow-xl outline-none md:hidden"><Dialog.Title className="sr-only">Navigasi utama</Dialog.Title><NavigationContent {...props} collapsed={false} mobile onCloseMobile={() => onMobileOpenChange?.(false)} /></Dialog.Content></Dialog.Portal></Dialog.Root></Tooltip.Provider>;
}
