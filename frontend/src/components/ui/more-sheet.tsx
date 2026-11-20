"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  ChevronRight,
  LogOut,
  PiggyBank,
  Repeat2,
  Settings,
  Tags,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { AppDialog, AppDialogContent, AppDialogBody, AppDialogDescription, AppDialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { amountCompact, toNumber } from "@/components/dashboard/formatters";
import { api } from "@/lib/api";
import { afterSheetHistorySettled } from "@/lib/sheet-history";
import { useWalletBalances } from "@/lib/swr";

type MoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string;
  profileEmail: string;
  logoutBusy?: boolean;
  onLogout: () => void;
};

const SMALL_TILES: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/analytics", label: "Analitik", icon: BarChart3 },
  { href: "/planning", label: "Target", icon: Target },
  { href: "/recurring", label: "Berulang", icon: Repeat2 },
  { href: "/reimbursements", label: "Reimburse", icon: ArrowRightLeft },
  { href: "/taxonomy", label: "Kategori", icon: Tags },
  { href: "/automation", label: "Otomasi", icon: Activity },
];

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "OK";
}

/** "Lainnya": every destination that is not in the dock, plus profile, theme, settings and sign-out. */
export function MoreSheet({ open, onOpenChange, profileName, profileEmail, logoutBusy = false, onLogout }: MoreSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const period = currentPeriod();

  const { data: balances } = useWalletBalances();
  const { data: budget } = useSWR(open ? (["budget", period, "summary"] as const) : null, () =>
    api.getMonthlyBudget(period).catch(() => null)
  );

  const totalBalance = balances?.reduce((sum, wallet) => sum + toNumber(wallet.curr_balance), 0);
  const allocated = budget ? toNumber(budget.total_allocated) : 0;
  const spent = budget ? budget.allocations.reduce((sum, item) => sum + toNumber(item.spent_amount), 0) : 0;
  const budgetLeft = allocated - spent;

  // Close first, let the sheet's history entry unwind, then navigate: back never lands on a stale sheet.
  const go = (href: string) => (event: MouseEvent) => {
    event.preventDefault();
    onOpenChange(false);
    window.setTimeout(() => afterSheetHistorySettled(() => router.push(href)), 60);
  };

  const tile = (href: string, className: string, children: ReactNode) => (
    <Link
      href={href}
      onClick={go(href)}
      aria-current={pathname === href ? "page" : undefined}
      className={`rounded-3xl border border-line outline-none transition-transform active:scale-[0.97] ${className}`}
    >
      {children}
    </Link>
  );

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="md" showCloseButton={false} aria-describedby={undefined}>
        <div className="px-5 pb-1 pt-1">
          <AppDialogTitle className="font-display text-2xl font-semibold">Lainnya</AppDialogTitle>
          <AppDialogDescription className="sr-only">Semua halaman, profil, tema, dan pengaturan.</AppDialogDescription>
        </div>

        <AppDialogBody className="safe-bottom space-y-4 pt-3">
          {/* Two uneven hero tiles carry a live number each. */}
          <div className="grid grid-cols-5 gap-3">
            {tile(
              "/wallets",
              "col-span-3 -rotate-1 bg-card p-4 shadow-[0_6px_18px_-10px_rgb(var(--shadow-color)/0.4)]",
              <>
                <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                  <WalletCards className="size-4" aria-hidden="true" />
                  Dompet
                </span>
                <span className="font-display mt-5 block text-[1.75rem] font-semibold leading-none text-ink">
                  {totalBalance === undefined ? <span className="skeleton block h-7 w-28" /> : amountCompact(totalBalance)}
                </span>
                <span className="mt-1.5 block text-xs text-ink-soft">
                  {balances ? `Total saldo ${balances.length} dompet` : "Memuat saldo"}
                </span>
              </>
            )}
            {tile(
              "/budgets",
              "col-span-2 mt-3 rotate-[1.5deg] bg-mint-soft p-4",
              <>
                <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                  <PiggyBank className="size-4" aria-hidden="true" />
                  Anggaran
                </span>
                <span className={`font-display mt-5 block text-xl font-semibold leading-none ${budgetLeft < 0 ? "text-negative" : "text-ink"}`}>
                  {budget === undefined ? <span className="skeleton block h-6 w-20" /> : allocated > 0 ? amountCompact(budgetLeft) : "Atur"}
                </span>
                <span className="mt-1.5 block text-xs text-ink-soft">
                  {allocated > 0 ? (budgetLeft < 0 ? "Melebihi anggaran" : "Sisa bulan ini") : "Belum ada anggaran"}
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {SMALL_TILES.map(({ href, label, icon: Icon }) => (
              <div key={href} className="contents">
                {tile(
                  href,
                  "flex min-h-[4.75rem] flex-col justify-between bg-paper-sunk p-3",
                  <>
                    <Icon className="size-5 text-ink" aria-hidden="true" />
                    <span className="text-sm font-semibold text-ink">{label}</span>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-3xl surface-raised">
            <Link
              href="/settings?tab=profile"
              onClick={go("/settings?tab=profile")}
              className="flex min-h-[3.75rem] items-center gap-3 px-4 py-3 outline-none active:bg-paper-sunk"
            >
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-sm font-bold text-ink">
                {initials(profileName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{profileName}</span>
                <span className="block truncate text-xs text-ink-soft">{profileEmail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </Link>

            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <span className="text-sm font-semibold text-ink">Tema</span>
              <ThemeToggle />
            </div>

            <Link
              href="/settings"
              onClick={go("/settings")}
              className="flex min-h-[3.25rem] items-center gap-3 border-t border-line px-4 outline-none active:bg-paper-sunk"
            >
              <Settings className="size-5 text-ink-soft" aria-hidden="true" />
              <span className="flex-1 text-sm font-semibold text-ink">Pengaturan</span>
              <ChevronRight className="size-4 text-ink-faint" aria-hidden="true" />
            </Link>

            <button
              type="button"
              disabled={logoutBusy}
              onClick={onLogout}
              className="flex min-h-[3.25rem] w-full items-center gap-3 border-t border-line px-4 text-left active:bg-negative-soft"
            >
              <LogOut className="size-5 text-negative" aria-hidden="true" />
              <span className="text-sm font-semibold text-negative">{logoutBusy ? "Keluar…" : "Keluar"}</span>
            </button>
          </div>
        </AppDialogBody>
      </AppDialogContent>
    </AppDialog>
  );
}
