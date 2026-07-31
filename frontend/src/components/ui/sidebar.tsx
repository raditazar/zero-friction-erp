"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  BarChart3,
  Bot,
  ChevronsUpDown,
  ClipboardCheck,
  CreditCard,
  DatabaseZap,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  ReceiptText,
  Repeat2,
  Settings,
  Tags,
  WalletCards,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const sidebarVariants = {
  open: {
    width: "15rem",
  },
  closed: {
    width: "3.25rem",
  },
};

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
};

const itemTextVariants = {
  open: {
    x: 0,
    opacity: 1,
    transition: {
      x: { stiffness: 1000, velocity: -100 },
    },
  },
  closed: {
    x: -12,
    opacity: 0,
    transition: {
      x: { stiffness: 100 },
    },
  },
};

const transitionProps = {
  type: "tween",
  ease: "easeOut",
  duration: 0.18,
  staggerChildren: 0.08,
} as const;

const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.025, delayChildren: 0.02 },
  },
};

export type SidebarNavItem = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  badge?: string;
};

export type SidebarNavSection = {
  label: string;
  items: SidebarNavItem[];
};

export type SessionNavBarProps = {
  activeItemId?: string;
  busy?: boolean;
  className?: string;
  items?: SidebarNavSection[];
  onItemSelect?: (id: string) => void;
  onLogout?: () => void;
  organizationName?: string;
  profileEmail?: string;
  profileName?: string;
  readyStatus?: string;
};

const defaultSections: SidebarNavSection[] = [
  {
    label: "Command & Core",
    items: [
      { id: "dashboard", label: "Overview", href: "/", icon: LayoutDashboard },
      { id: "review", label: "Kotak Masuk", href: "/inbox", icon: ClipboardCheck, badge: "Staging" },
      { id: "transactions", label: "Buku Besar", href: "/transactions", icon: ReceiptText },
      { id: "analytics", label: "Laporan & Tren", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Kelola Keuangan",
    items: [
      { id: "wallets", label: "Dompet & Transfer", href: "/wallets", icon: WalletCards },
      { id: "budgets", label: "Anggaran Belanja", href: "/budgets", icon: PiggyBank },
      { id: "reimbursements", label: "Piutang Reimburse", href: "/reimbursements", icon: ArrowRightLeft },
      { id: "planning", label: "Target Tabungan", href: "/planning", icon: CreditCard },
    ],
  },
  {
    label: "Otomatisasi & Master",
    items: [
      { id: "taxonomy", label: "Kategori & Tag", href: "/taxonomy", icon: Tags },
      { id: "recurring", label: "Tagihan Berulang", href: "/recurring", icon: Repeat2 },
    ],
  },
  {
    label: "Bantuan & Sistem",
    items: [
      { id: "guide", label: "Panduan Penggunaan", href: "/guide", icon: Bot, badge: "Help" },
      { id: "settings", label: "Pengaturan & Profil", href: "/settings", icon: Settings },
    ],
  },
];

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SidebarLabel({
  badge,
  isCollapsed,
  label,
}: {
  badge?: string;
  isCollapsed: boolean;
  label: string;
}) {
  return (
    <motion.span variants={itemTextVariants} className="flex min-w-0 flex-1 items-center gap-2">
      {!isCollapsed ? (
        <>
          <span className="truncate text-sm font-medium">{label}</span>
          {badge ? (
            <Badge className="h-5 rounded-md border border-primary/18 bg-transparent px-1.5 text-[10px] text-primary" variant="outline">
              {badge}
            </Badge>
          ) : null}
        </>
      ) : null}
    </motion.span>
  );
}

export function SessionNavBar({
  activeItemId,
  busy = false,
  className,
  items = defaultSections,
  onItemSelect,
  onLogout,
  organizationName = "Zero-Friction ERP",
  profileEmail = "finance@workspace.local",
  profileName = "Finance Ops",
  readyStatus = "checking",
}: SessionNavBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();

  function isActive(item: SidebarNavItem) {
    if (activeItemId) return activeItemId === item.id;
    if (!item.href) return false;
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  }

  function renderItem(item: SidebarNavItem) {
    const Icon = item.icon;
    const active = isActive(item);
    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" />
        <SidebarLabel badge={item.badge} isCollapsed={isCollapsed} label={item.label} />
      </>
    );
    const className = cn(
      "flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
      active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
    );

    if (onItemSelect) {
      return (
        <button key={item.id} type="button" className={className} onClick={() => onItemSelect(item.id)}>
          {content}
        </button>
      );
    }

    return (
      <Link key={item.id} href={item.href ?? "#"} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <motion.aside
      className={cn("sidebar fixed left-0 top-0 z-40 h-full shrink-0 border-r border-border bg-background", className)}
      initial={isCollapsed ? "closed" : "open"}
      animate={isCollapsed ? "closed" : "open"}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
    >
      <motion.div className="relative z-40 flex h-full shrink-0 flex-col bg-background text-muted-foreground" variants={contentVariants}>
        <div className="flex h-[54px] w-full shrink-0 border-b border-border p-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="w-full" asChild>
              <Button variant="ghost" size="sm" className="flex w-full justify-start gap-2 px-2">
                <Avatar className="size-5 rounded">
                  <AvatarFallback className="rounded-md bg-[#273538] text-[11px] font-semibold text-primary">
                    <Landmark className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <motion.span variants={itemTextVariants} className="flex min-w-0 flex-1 items-center gap-2">
                  {!isCollapsed ? (
                    <>
                      <span className="truncate text-sm font-semibold text-foreground">{organizationName}</span>
                      <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground/60" />
                    </>
                  ) : null}
                </motion.span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem className="flex items-center gap-2">
                <DatabaseZap className="h-4 w-4" /> Backend: {readyStatus}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Finance workspace
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Workspace settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <motion.div variants={staggerVariants} className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1 px-2 py-2">
            <div className="grid gap-3 pb-2">
              {items.map((section, index) => (
                <div key={section.label} className="grid gap-1">
                  {!isCollapsed ? (
                    <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/52">
                      {section.label}
                    </p>
                  ) : index > 0 ? (
                    <Separator className="my-1" />
                  ) : null}
                  {section.items.map(renderItem)}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-border p-2">
            <button
              type="button"
              className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onLogout}
              disabled={busy || !onLogout}
            >
              <Avatar className="size-4">
                <AvatarFallback className="text-[10px]">{initials(profileName) || "FO"}</AvatarFallback>
              </Avatar>
              <motion.span variants={itemTextVariants} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {!isCollapsed ? (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{profileName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{profileEmail}</span>
                    </span>
                    <LogOut className="h-4 w-4 text-muted-foreground/60" />
                  </>
                ) : null}
              </motion.span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </motion.aside>
  );
}
