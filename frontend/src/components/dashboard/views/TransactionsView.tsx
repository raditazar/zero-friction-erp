"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  ArrowLeftRight,
  SlidersHorizontal,
  X,
  Check,
  Clock,
  Edit3,
  Trash2,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { api, type Category, type Transaction, type TransactionQuery, type TransactionStatus, type Wallet } from "@/lib/api";
import { statuses, transactionTypes } from "../model";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { Fact } from "@/components/ui/dashboard";
import { LoadingState } from "@/components/ui/feedback";
import { MetricCard } from "@/components/ui/cards/metric-card";
import { NativeSelectField, SearchField } from "@/components/ui/form";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { ActionMenu } from "@/components/ui/action-menu";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogBody,
  AppDialogFooter,
  useMediaQuery,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

const STATUS_LABEL: Record<string, string> = {
  approved: "Disetujui",
  needs_review: "Perlu ditinjau",
  pending: "Menunggu",
  rejected: "Ditolak",
};

const sortable = new Set(["transaction_at", "merchant", "status", "amount"]);
type Cell = { row: number; column: number };

type Props = {
  wallets: Wallet[];
  categories: Category[];
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  query: string;
  typeFilter: string;
  statusFilter: string;
  categoryFilter: string;
  walletFilter: string;
  refreshKey: number;
  onTypeFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
  onCategoryFilter: (value: string) => void;
  onWalletFilter: (value: string) => void;
  onQueryChange: (value: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
  onBulk: (ids: string[], status: TransactionStatus) => Promise<void>;
  /** Reload the ledger after a change that did not go through onBulk/onEdit/onDelete. */
  onRefresh?: () => void;
  onNewTransfer: () => void;
  onNewTransaction?: () => void;
  onExportCSV?: () => void;
  onImportCSV?: () => void;
  onExportPDF?: () => void;
};

function getInitial(merchant?: string | null, categoryName?: string | null, type?: string) {
  if (type === "transfer") return "TR";
  if (merchant && merchant.trim()) {
    const parts = merchant.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return merchant.slice(0, 2).toUpperCase();
  }
  if (categoryName && categoryName.trim()) {
    const parts = categoryName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return categoryName.slice(0, 2).toUpperCase();
  }
  return "TX";
}

export function TransactionsView(props: Props) {
  const { wallets, categories, walletById, categoryById, query, typeFilter, statusFilter, categoryFilter, walletFilter, refreshKey } = props;
  const [rows, setRows] = useState<Transaction[]>([]);
  const [reimbFilter, setReimbFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sorting, setSorting] = useState<SortingState>([{ id: "transaction_at", desc: true }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [activeCell, setActiveCell] = useState<Cell>({ row: 0, column: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const deferredQuery = useDeferredValue(query);
  const activeSort = sorting[0] ?? { id: "transaction_at", desc: true };

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      id: "transaction_at",
      header: "Tanggal",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium text-ink">
          {dateLabel(row.original.transaction_at)}
        </span>
      ),
    },
    {
      id: "merchant",
      header: "Merchant",
      cell: ({ row }) => (
        <span className="font-semibold text-ink">
          {row.original.merchant || (row.original.type === "transfer" ? "Transfer Antar Dompet" : "Tanpa merchant")}
        </span>
      ),
    },
    {
      id: "wallet",
      header: "Dompet",
      cell: ({ row }) => (
        <span className="text-ink-soft">
          {walletById.get(row.original.wallet_id)?.name ?? shortID(row.original.wallet_id)}
          {row.original.type === "transfer" && row.original.destination_wallet_id && (
            <>
              <ArrowRight className="mx-1 inline size-3 align-[-1px]" aria-label="ke" />
              {walletById.get(row.original.destination_wallet_id)?.name ?? shortID(row.original.destination_wallet_id)}
            </>
          )}
        </span>
      ),
    },
    {
      id: "category",
      header: "Kategori",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center rounded-md bg-paper-sunk px-2 py-0.5 text-xs font-medium text-ink">
            {categoryById.get(row.original.category_id ?? "")?.name ?? "Belum dikategorikan"}
          </span>
          {row.original.is_reimbursement && (
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                row.original.reimbursement_status === "reimbursed"
                  ? "border-positive-line bg-positive-soft text-positive"
                  : "border-caution-line bg-caution-soft text-caution"
              }`}
            >
              {row.original.reimbursement_status === "reimbursed" ? "Klaim Lunas" : "Piutang"}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        const colorClass =
          s === "approved"
            ? "bg-positive-soft text-positive"
            : s === "needs_review"
            ? "bg-caution-soft text-caution"
            : "bg-negative-soft text-negative";
        return (
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorClass}`}>
            {s}
          </span>
        );
      },
    },
    {
      id: "amount",
      header: "Nominal",
      cell: ({ row }) => {
        const isExpense = row.original.type === "expense";
        const isIncome = row.original.type === "income";
        return (
          <span
            className={`font-mono tabular-nums font-semibold ${
              isExpense ? "text-negative" : isIncome ? "text-positive" : "text-ink"
            }`}
          >
            {isExpense ? "-" : isIncome ? "+" : ""}
            {amount(row.original.amount)}
          </span>
        );
      },
    },
  ], [categoryById, walletById]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");

    const queryParams: TransactionQuery = {
      page,
      page_size: pageSize,
      sort: activeSort.id as TransactionQuery["sort"],
      order: activeSort.desc ? "desc" : "asc",
      ...(deferredQuery ? { q: deferredQuery } : {}),
      ...(typeFilter !== "all" ? { type: typeFilter as TransactionQuery["type"] } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter as TransactionQuery["status"] } : {}),
      ...(categoryFilter !== "all" ? { category_id: categoryFilter } : {}),
      ...(walletFilter !== "all" ? { wallet_id: walletFilter } : {}),
      ...(reimbFilter !== "all" ? { is_reimbursement: reimbFilter === "reimbursement" ? "true" : "false" } : {}),
    };

    api.transactions(queryParams)
      .then((res) => {
        if (!active) return;
        setRows(res.data);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.total_pages);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Gagal memuat transaksi");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, pageSize, activeSort.id, activeSort.desc, deferredQuery, typeFilter, statusFilter, categoryFilter, walletFilter, reimbFilter, refreshKey]);

  useEffect(() => {
    setActiveCell((current) => ({
      row: Math.min(current.row, Math.max(0, rows.length - 1)),
      column: Math.min(current.column, columns.length - 1),
    }));
  }, [columns.length, rows.length]);

  function focusCell(next: Cell) {
    const bounded = {
      row: Math.max(0, Math.min(rows.length - 1, next.row)),
      column: Math.max(0, Math.min(columns.length - 1, next.column)),
    };
    setActiveCell(bounded);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-grid-row="${bounded.row}"][data-grid-column="${bounded.column}"]`)
      ?.focus();
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!rows.length) return;
    const moves: Record<string, Cell> = {
      ArrowDown: { row: 1, column: 0 },
      ArrowUp: { row: -1, column: 0 },
      ArrowRight: { row: 0, column: 1 },
      ArrowLeft: { row: 0, column: -1 },
    };
    if (moves[event.key]) {
      event.preventDefault();
      focusCell({ row: activeCell.row + moves[event.key].row, column: activeCell.column + moves[event.key].column });
    } else if (event.key === "Home") {
      event.preventDefault();
      focusCell({ row: activeCell.row, column: 0 });
    } else if (event.key === "End") {
      event.preventDefault();
      focusCell({ row: activeCell.row, column: columns.length - 1 });
    } else if (event.key === "Enter") {
      event.preventDefault();
      setDetail(rows[activeCell.row]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDetail(null);
    }
  }

  // The sheet keeps showing the last transaction while it animates out.
  const isWide = useMediaQuery("(min-width: 1024px)");

  // Infinite scroll on phones: grow the first page instead of paging, so the list never
  // jumps or duplicates rows when filters change underneath it.
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const canLoadMore = !isWide && !loading && rows.length > 0 && rows.length < total && pageSize < 1000;
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPage(1);
          setPageSize((size) => Math.min(1000, size + 50));
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [canLoadMore]);
  const [sheetTx, setSheetTx] = useState<Transaction | null>(null);
  if (detail && detail !== sheetTx) setSheetTx(detail);

  async function toggleReimbursement(transaction: Transaction) {
    try {
      if (!transaction.is_reimbursement) {
        await api.markReimbursement(transaction.id);
        toast.success("Ditandai sebagai piutang reimbursement.");
      } else {
        await api.patchTransaction(transaction.id, { is_reimbursement: false, reimbursement_status: "none" });
        toast.success("Status reimbursement dibatalkan.");
      }
      props.onRefresh?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status.";
      toast.error("Gagal mengubah status reimbursement", { detail: msg });
    }
  }

  async function applyBulk(status: TransactionStatus) {
    const ids = [...selected];
    if (!ids.length) return;
    await props.onBulk(ids, status);
    setSelected(new Set());
  }

  const totalIncome = useMemo(() => rows.filter(r => r.type === "income").reduce((sum, r) => {
    const val = typeof r.amount === "number" ? r.amount : parseFloat(String(r.amount)) || 0;
    return sum + val;
  }, 0), [rows]);

  const totalExpense = useMemo(() => rows.filter(r => r.type === "expense").reduce((sum, r) => {
    const val = typeof r.amount === "number" ? r.amount : parseFloat(String(r.amount)) || 0;
    return sum + val;
  }, 0), [rows]);

  const netCashflow = totalIncome - totalExpense;

  // Date grouping for mobile list
  const dateGroups = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    const groupOrder: string[] = [];

    for (const tx of rows) {
      const d = new Date(tx.transaction_at);
      const dateKey = !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : "unknown";

      if (!groups[dateKey]) {
        groups[dateKey] = [];
        groupOrder.push(dateKey);
      }
      groups[dateKey].push(tx);
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    return groupOrder.map((dateKey) => {
      const txs = groups[dateKey];
      let formattedDate = dateKey;
      if (dateKey !== "unknown") {
        const parts = dateKey.split("-").map(Number);
        const groupDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const datePart = new Intl.DateTimeFormat("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(groupDate);

        if (dateKey === todayKey) {
          formattedDate = `Hari ini, ${datePart}`;
        } else if (dateKey === yesterdayKey) {
          formattedDate = `Kemarin, ${datePart}`;
        } else {
          const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(groupDate);
          formattedDate = `${weekday}, ${datePart}`;
        }
      } else {
        formattedDate = "Tanggal Lain";
      }

      return {
        dateKey,
        formattedDate,
        transactions: txs,
      };
    });
  }, [rows]);

  // Count active filters for badge
  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (walletFilter !== "all") count += 1;
    if (statusFilter !== "all") count += 1;
    if (categoryFilter !== "all") count += 1;
    if (reimbFilter === "non_reimbursement") count += 1;
    return count;
  }, [walletFilter, statusFilter, categoryFilter, reimbFilter]);

  // Filter chips options
  const filterChips = [
    {
      id: "all",
      label: "Semua",
      isActive: typeFilter === "all" && reimbFilter === "all",
      onClick: () => {
        props.onTypeFilter("all");
        setReimbFilter("all");
      },
    },
    {
      id: "expense",
      label: "Pengeluaran",
      isActive: typeFilter === "expense" && reimbFilter === "all",
      onClick: () => {
        props.onTypeFilter("expense");
        setReimbFilter("all");
      },
    },
    {
      id: "income",
      label: "Pemasukan",
      isActive: typeFilter === "income" && reimbFilter === "all",
      onClick: () => {
        props.onTypeFilter("income");
        setReimbFilter("all");
      },
    },
    {
      id: "transfer",
      label: "Transfer",
      isActive: typeFilter === "transfer" && reimbFilter === "all",
      onClick: () => {
        props.onTypeFilter("transfer");
        setReimbFilter("all");
      },
    },
    {
      id: "piutang",
      label: "Piutang",
      isActive: reimbFilter === "reimbursement",
      onClick: () => {
        props.onTypeFilter("all");
        setReimbFilter("reimbursement");
      },
    },
  ];

  return (
    <InfoTooltipProvider>
      <div className="w-full max-w-full min-w-0 space-y-4">
        {/* Desktop Header & Full Toolbar */}
        <div className="hidden lg:flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="eyebrow text-ink-soft">Ledger Transaksi</p>
              <InfoTooltip content="Tabel ledger terverifikasi. Gunakan tombol panah keyboard untuk navigasi cepat." />
            </div>
            <h3 className="section-title text-ink text-xl font-bold">
              Semua Catatan Transaksi
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {props.onNewTransaction && (
              <button className="btn-primary text-sm px-3.5 py-2 font-medium flex items-center gap-1.5 rounded-lg" onClick={props.onNewTransaction}>
                <Plus className="size-4" />
                Tambah Transaksi
              </button>
            )}
            <button className="btn-secondary text-sm px-3.5 py-2 font-medium flex items-center gap-1.5 rounded-lg" onClick={props.onNewTransfer}>
              <ArrowLeftRight className="size-4" />
              Transfer Antar Dompet
            </button>
            {props.onExportCSV && (
              <button className="btn-secondary text-sm px-3.5 py-2 font-medium rounded-lg" onClick={props.onExportCSV}>
                Ekspor CSV
              </button>
            )}
            {props.onImportCSV && (
              <button className="btn-secondary text-sm px-3.5 py-2 font-medium rounded-lg" onClick={props.onImportCSV}>
                Impor CSV
              </button>
            )}
            {props.onExportPDF && (
              <button className="btn-secondary text-sm px-3.5 py-2 font-medium rounded-lg" onClick={props.onExportPDF}>
                Ekspor PDF
              </button>
            )}
          </div>
        </div>

        {/* Mobile Action Bar (lg:hidden) */}
        <div className="flex lg:hidden items-center gap-2 w-full min-w-0">
          {props.onNewTransaction && (
            <button
              className="btn-primary flex-1 py-2.5 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 rounded-xl truncate"
              onClick={props.onNewTransaction}
            >
              <Plus className="size-4 shrink-0" />
              <span className="truncate">Transaksi</span>
            </button>
          )}
          <button
            className="btn-secondary flex-1 py-2.5 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 rounded-xl truncate"
            onClick={props.onNewTransfer}
          >
            <ArrowLeftRight className="size-3.5 shrink-0" />
            <span className="truncate">Transfer</span>
          </button>
          <div className="shrink-0 bg-card border border-line rounded-xl flex items-center justify-center p-1 shadow-sm">
            <ActionMenu
              items={[
                ...(props.onExportCSV ? [{ label: "Ekspor CSV", onClick: props.onExportCSV }] : []),
                ...(props.onImportCSV ? [{ label: "Impor CSV", onClick: props.onImportCSV }] : []),
                ...(props.onExportPDF ? [{ label: "Ekspor PDF", onClick: props.onExportPDF }] : []),
              ]}
            />
          </div>
        </div>

        {/* Mobile Compact Metrics Card (lg:hidden) */}
        <div className="lg:hidden bg-card border border-line rounded-xl p-3 shadow-sm">
          <div className="grid grid-cols-3 divide-x divide-line text-center">
            <div className="px-1 min-w-0">
              <p className="text-xs font-medium text-ink-soft truncate">Masuk</p>
              <p className="text-xs sm:text-sm font-bold text-positive tabular-nums truncate mt-0.5">
                +{amount(totalIncome)}
              </p>
            </div>
            <div className="px-1 min-w-0">
              <p className="text-xs font-medium text-ink-soft truncate">Keluar</p>
              <p className="text-xs sm:text-sm font-bold text-negative tabular-nums truncate mt-0.5">
                -{amount(totalExpense)}
              </p>
            </div>
            <div className="px-1 min-w-0">
              <p className="text-xs font-medium text-ink-soft truncate">Net Cashflow</p>
              <p className={cx("text-xs sm:text-sm font-bold tabular-nums truncate mt-0.5", netCashflow >= 0 ? "text-positive" : "text-negative")}>
                {netCashflow >= 0 ? "+" : ""}{amount(netCashflow)}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Summary Metrics Grid (hidden lg:grid) */}
        <div className="hidden lg:grid gap-4 grid-cols-1 md:grid-cols-3">
          <MetricCard
            label="Total Masuk"
            value={`+${amount(totalIncome)}`}
          />
          <MetricCard
            label="Total Keluar"
            value={`-${amount(totalExpense)}`}
          />
          <MetricCard
            label="Net Cashflow"
            value={`${netCashflow >= 0 ? "+" : ""}${amount(netCashflow)}`}
          />
        </div>

        {/* Mobile Search & Filter Lanjutan Row */}
        <div className="flex lg:hidden items-center gap-2 w-full min-w-0">
          <div className="flex-1 min-w-0">
            <SearchField 
              placeholder="Cari merchant atau catatan..." 
              value={query} 
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(e: any) => props.onQueryChange(e?.target ? e.target.value : e)} 
            />
          </div>
          <button
            type="button"
            onClick={() => setIsAdvancedFilterOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl border transition-colors shrink-0 shadow-sm ${
              activeAdvancedCount > 0
                ? "bg-primary text-primary-foreground border-ink"
                : "bg-card text-ink border-line hover:bg-paper"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Filter {activeAdvancedCount > 0 ? `(${activeAdvancedCount})` : ""}</span>
          </button>
        </div>

        {/* Horizontal Quick Filter Chips (Mobile & Desktop) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar min-w-0 w-full">
          {filterChips.map((chip) => {
            const isActive = chip.isActive;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onClick}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full shrink-0 transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-line text-ink-soft hover:text-ink hover:bg-paper"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Desktop Filter Dropdowns Grid (hidden lg:grid) */}
        <div className="hidden lg:grid gap-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(140px,1fr))]">
          <SearchField 
            placeholder="Cari merchant atau catatan..." 
            value={query} 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e: any) => props.onQueryChange(e?.target ? e.target.value : e)} 
          />
          <NativeSelectField
            value={typeFilter}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e: any) => props.onTypeFilter(e.target.value)}
          >
            <option value="all">Semua tipe</option>
            {transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </NativeSelectField>
          <NativeSelectField
            value={statusFilter}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e: any) => props.onStatusFilter(e.target.value)}
          >
            <option value="all">Semua status</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </NativeSelectField>
          <NativeSelectField
            value={walletFilter}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e: any) => props.onWalletFilter(e.target.value)}
          >
            <option value="all">Semua dompet</option>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </NativeSelectField>
          <NativeSelectField
            value={categoryFilter}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e: any) => props.onCategoryFilter(e.target.value)}
          >
            <option value="all">Semua kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelectField>
        </div>

        {/* Bulk Action Toolbar */}
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card border border-line p-3 text-sm text-ink shadow-sm">
            <span className="font-semibold">{selected.size} transaksi terpilih</span>
            <button className="btn-compact bg-primary text-primary-foreground rounded-lg" onClick={() => void applyBulk("approved")}>Setujui</button>
            <button className="btn-compact bg-negative-solid text-primary-foreground rounded-lg" onClick={() => void applyBulk("rejected")}>Tolak</button>
            <button className="btn-compact bg-caution-solid text-primary-foreground rounded-lg" onClick={() => void applyBulk("needs_review")}>Tinjau Ulang</button>
            <button className="btn-compact rounded-lg" onClick={() => setSelected(new Set())}>Batal</button>
          </div>
        ) : null}

        {loadError ? <p className="text-sm font-medium text-negative">{loadError}</p> : null}

        {/* Main Content Layout (Desktop Grid & Mobile List) */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem] min-w-0 w-full">
          {/* Desktop Table View (lg:block) */}
          <div
            ref={gridRef}
            role="grid"
            aria-label="Ledger transaksi"
            aria-rowcount={total}
            onKeyDown={onGridKeyDown}
            className="hidden overflow-x-auto rounded-xl border border-line bg-card shadow-sm lg:block"
          >
            <table className="min-w-[850px] w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-paper text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-line">
                <tr>
                  <th className="w-12 px-3 py-3 text-left">
                    <span className="sr-only">Pilih</span>
                  </th>
                  {table.getFlatHeaders().map((header) => (
                    <th key={header.id} className={cx("px-3 py-3 text-left", header.id === "amount" && "text-right")}>
                      <button
                        className="inline-flex items-center gap-1 font-semibold hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                        disabled={!sortable.has(header.id)}
                        onClick={() => header.column.toggleSorting(header.column.getIsSorted() === "asc")}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? <ArrowUp className="size-3" aria-label="urut naik" /> : header.column.getIsSorted() === "desc" ? <ArrowDown className="size-3" aria-label="urut turun" /> : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-ink-soft font-medium">
                      Memuat data ledger...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-ink-soft font-medium">
                      Belum ada catatan transaksi yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row, rowIndex) => (
                    <tr
                      key={row.id}
                      className={cx(
                        "transition-colors hover:bg-paper",
                        detail?.id === row.original.id && "bg-paper"
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Pilih ${row.original.merchant ?? "transaksi"}`}
                          type="checkbox"
                          checked={selected.has(row.original.id)}
                          onChange={() =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (next.has(row.original.id)) next.delete(row.original.id); else next.add(row.original.id);
                              return next;
                            })
                          }
                          className="h-4 w-4 rounded border-line accent-ink"
                        />
                      </td>
                      {row.getVisibleCells().map((cell, column) => (
                        <td key={cell.id} role="gridcell" className={cx("p-0", cell.column.id === "amount" && "text-right")}>
                          <button
                            data-grid-row={rowIndex}
                            data-grid-column={column}
                            tabIndex={activeCell.row === rowIndex && activeCell.column === column ? 0 : -1}
                            onFocus={() => setActiveCell({ row: rowIndex, column })}
                            onClick={() => setDetail(row.original)}
                            className="w-full px-3 py-3 text-left outline-none hover:bg-paper focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Date-Grouped Transaction List (lg:hidden) */}
          <div className="space-y-4 lg:hidden w-full min-w-0">
            {loading && rows.length === 0 ? (
              <LoadingState variant="list" rows={6} label="Memuat transaksi" />
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-ink-soft bg-card rounded-xl border border-line p-6 shadow-sm">
                <p className="font-medium text-ink">Belum ada transaksi</p>
                <p className="mt-1 text-xs text-ink-soft">Tidak ada catatan transaksi yang sesuai dengan filter.</p>
              </div>
            ) : (
              dateGroups.map((group) => (
                <div key={group.dateKey} className="space-y-1.5 w-full min-w-0">
                  {/* Date Group Header */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-ink-soft tracking-wide">
                      {group.formattedDate}
                    </span>
                    <span className="text-xs font-medium text-ink-soft">
                      {group.transactions.length} transaksi
                    </span>
                  </div>

                  {/* Group Items Container */}
                  <div className="bg-card border border-line rounded-xl overflow-hidden divide-y divide-line shadow-sm w-full min-w-0">
                    {group.transactions.map((transaction) => {
                      const isExpense = transaction.type === "expense";
                      const isIncome = transaction.type === "income";
                      const isTransfer = transaction.type === "transfer";
                      const walletName = walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id);
                      const destWalletName = transaction.destination_wallet_id
                        ? walletById.get(transaction.destination_wallet_id)?.name ?? shortID(transaction.destination_wallet_id)
                        : null;
                      const categoryName = categoryById.get(transaction.category_id ?? "")?.name;
                      const initial = getInitial(transaction.merchant, categoryName, transaction.type);

                      return (
                        <button
                          key={transaction.id}
                          type="button"
                          onClick={() => setDetail(transaction)}
                          className="w-full p-3.5 flex items-center justify-between gap-3 text-left transition-colors active:bg-paper hover:bg-paper focus-visible:outline-none focus-visible:bg-paper min-w-0"
                        >
                          {/* Left: Avatar & Info */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="bg-paper border border-line text-ink font-bold text-xs rounded-xl size-10 flex items-center justify-center shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-ink truncate leading-tight">
                                {transaction.merchant || (isTransfer ? `Transfer ${walletName} ke ${destWalletName || "dompet lain"}` : "Tanpa merchant")}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-ink-soft truncate">
                                <span className="truncate">
                                  {isTransfer ? (
                                    <>
                                      {walletName}
                                      <ArrowRight className="mx-1 inline size-3 align-[-1px]" aria-label="ke" />
                                      {destWalletName}
                                    </>
                                  ) : walletName}
                                </span>
                                {categoryName && (
                                  <>
                                    <span className="text-line shrink-0">·</span>
                                    <span className="truncate">{categoryName}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Amount & Badges */}
                          <div className="flex flex-col items-end shrink-0 pl-1">
                            <span
                              className={`font-mono text-sm font-semibold tabular-nums ${
                                isExpense
                                  ? "text-negative"
                                  : isIncome
                                  ? "text-positive"
                                  : "text-ink"
                              }`}
                            >
                              {isExpense ? "-" : isIncome ? "+" : ""}
                              {amount(transaction.amount)}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              {transaction.is_reimbursement && (
                                <span
                                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                    transaction.reimbursement_status === "reimbursed"
                                      ? "border-positive-line bg-positive-soft text-positive"
                                      : "border-caution-line bg-caution-soft text-caution"
                                  }`}
                                >
                                  {transaction.reimbursement_status === "reimbursed" ? "Klaim Lunas" : "Piutang"}
                                </span>
                              )}
                              {transaction.status !== "approved" && (
                                <span
                                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
                                    transaction.status === "needs_review"
                                      ? "bg-caution-soft text-caution"
                                      : "bg-negative-soft text-negative"
                                  }`}
                                >
                                  {transaction.status === "needs_review" ? "Tinjau" : "Ditolak"}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            {/* Phones: no pager. Reaching the end loads the next 50 into the same list. */}
            {rows.length > 0 ? (
              <div ref={loadMoreRef} className="flex justify-center py-4 text-xs text-ink-soft">
                {rows.length < total ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-ink-faint border-t-transparent" aria-hidden="true" />
                    Memuat lagi
                  </span>
                ) : (
                  <span>{total.toLocaleString("id-ID")} transaksi</span>
                )}
              </div>
            ) : null}
          </div>

          {/* Desktop Side Panel Detail (hidden lg:block) */}
          <aside aria-live="polite" className="hidden lg:block rounded-xl border border-line bg-card p-5 shadow-sm">
            {detail ? (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <p className="eyebrow text-ink-soft">Detail Transaksi</p>
                    <h4 className="mt-1 font-bold text-lg text-ink">{detail.merchant || (detail.type === "transfer" ? "Transfer Antar Dompet" : "Tanpa merchant")}</h4>
                  </div>
                  <button className="link-button text-xs font-semibold text-ink-soft hover:text-ink" onClick={() => setDetail(null)}>
                    Tutup
                  </button>
                </div>
                <dl className="mt-4 grid gap-3">
                  <Fact label="Tanggal" value={dateLabel(detail.transaction_at)} />
                  <Fact label="Dompet" value={walletById.get(detail.wallet_id)?.name ?? shortID(detail.wallet_id)} />
                  {detail.type === "transfer" && detail.destination_wallet_id && (
                    <Fact label="Dompet Tujuan" value={walletById.get(detail.destination_wallet_id)?.name ?? shortID(detail.destination_wallet_id)} />
                  )}
                  {detail.type !== "transfer" && (
                    <Fact label="Kategori" value={categoryById.get(detail.category_id ?? "")?.name ?? "Belum dikategorikan"} />
                  )}
                  <Fact label="Jumlah" value={amount(detail.amount)} />
                  <Fact label="Status" value={detail.status} />
                  {detail.is_reimbursement && (
                    <Fact
                      label="Reimbursement"
                      value={detail.reimbursement_status === "reimbursed" ? "Klaim Lunas" : "Piutang (Belum Cair)"}
                    />
                  )}
                  {detail.note && <Fact label="Catatan" value={detail.note} />}
                </dl>
                <div className="mt-6 flex justify-end pt-3 border-t border-line">
                  <ActionMenu
                    items={[
                      { label: "Setujui", onClick: () => void props.onBulk([detail.id], "approved") },
                      { label: "Tolak", onClick: () => void props.onBulk([detail.id], "rejected") },
                      { label: "Tinjau Ulang", onClick: () => void props.onBulk([detail.id], "needs_review") },
                      ...(detail.type === "expense"
                        ? [
                            {
                              label: detail.is_reimbursement
                                ? "Batalkan Piutang (Belanja Pribadi)"
                                : "Tandai sebagai Reimbursement (Piutang)",
                              onClick: async () => {
                                try {
                                  if (!detail.is_reimbursement) {
                                    await api.markReimbursement(detail.id);
                                    toast.success("Transaksi berhasil ditandai sebagai piutang reimbursement.");
                                  } else {
                                    await api.patchTransaction(detail.id, {
                                      is_reimbursement: false,
                                      reimbursement_status: "none",
                                    });
                                    toast.success("Status reimbursement berhasil dibatalkan.");
                                  }
                                  setDetail(null);
                                  props.onRefresh?.();
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : "Gagal mengubah status.";
                                  toast.error("Gagal mengubah status reimbursement", { detail: msg });
                                }
                              },
                            },
                          ]
                        : []),
                      { label: "Edit Detail", onClick: () => props.onEdit(detail) },
                      {
                        label: "Hapus",
                        destructive: true,
                        onClick: () => void props.onDelete(detail.id),
                      }
                    ]}
                  />
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-ink-soft">Pilih transaksi untuk melihat detail lengkap.</p>
                <p className="mt-2 text-xs text-ink-soft">Gunakan navigasi panah keyboard dan tekan Enter pada grid.</p>
              </div>
            )}
          </aside>
        </div>

        {/* Pagination Bar (desktop; phones load more on scroll) */}
        <div className="mt-6 hidden lg:flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-4 text-xs sm:text-sm font-medium text-ink-soft">
          <span>
            Halaman <strong className="text-ink">{page}</strong> dari <strong className="text-ink">{totalPages}</strong> ({total} total transaksi)
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              Baris:
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink outline-none focus:ring-2 focus:ring-ink"
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-compact" disabled={page <= 1} onClick={() => setPage((c) => c - 1)}>
              Sebelumnya
            </button>
            <button className="btn-compact" disabled={page >= totalPages} onClick={() => setPage((c) => c + 1)}>
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filter Modal (AppDialog on Mobile/Desktop) */}
      <AppDialog open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
        <AppDialogContent size="sm">
          <AppDialogHeader>
            <AppDialogTitle>Filter Lanjutan</AppDialogTitle>
            <AppDialogDescription>
              Saring transaksi berdasarkan dompet, status, dan kategori.
            </AppDialogDescription>
          </AppDialogHeader>
          <AppDialogBody className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Dompet</label>
              <NativeSelectField
                value={walletFilter}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e: any) => props.onWalletFilter(e.target.value)}
              >
                <option value="all">Semua Dompet</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </NativeSelectField>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Status Verifikasi</label>
              <NativeSelectField
                value={statusFilter}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e: any) => props.onStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s === "approved" ? "Disetujui (Approved)" : s === "needs_review" ? "Perlu Ditinjau" : "Ditolak (Rejected)"}
                  </option>
                ))}
              </NativeSelectField>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Kategori</label>
              <NativeSelectField
                value={categoryFilter}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e: any) => props.onCategoryFilter(e.target.value)}
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelectField>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Jenis Piutang / Belanja</label>
              <NativeSelectField
                value={reimbFilter}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e: any) => setReimbFilter(e?.target ? e.target.value : e)}
              >
                <option value="all">Semua</option>
                <option value="reimbursement">Hanya Reimbursement (Piutang)</option>
                <option value="non_reimbursement">Hanya Belanja Pribadi</option>
              </NativeSelectField>
            </div>
          </AppDialogBody>
          <AppDialogFooter className="flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                props.onWalletFilter("all");
                props.onStatusFilter("all");
                props.onCategoryFilter("all");
                setReimbFilter("all");
                setIsAdvancedFilterOpen(false);
              }}
              className="btn-secondary flex-1 py-2.5 text-xs font-semibold rounded-lg"
            >
              Reset Filter
            </button>
            <button
              type="button"
              onClick={() => setIsAdvancedFilterOpen(false)}
              className="btn-primary flex-1 py-2.5 text-xs font-semibold rounded-lg"
            >
              Terapkan
            </button>
          </AppDialogFooter>
        </AppDialogContent>
      </AppDialog>

      {/* Mobile/tablet: transaction detail in the shared Sheet, actions pinned in the thumb zone. */}
      <AppDialog open={Boolean(detail) && !isWide} onOpenChange={(next) => { if (!next) setDetail(null); }}>
        <AppDialogContent size="md">
          {sheetTx ? (
            <>
              <AppDialogHeader>
                <AppDialogDescription className="text-xs font-semibold uppercase tracking-wider">Detail transaksi</AppDialogDescription>
                <AppDialogTitle className="truncate">
                  {sheetTx.merchant || (sheetTx.type === "transfer" ? "Transfer antar dompet" : "Tanpa merchant")}
                </AppDialogTitle>
              </AppDialogHeader>

              <AppDialogBody className="pt-0">
                <p
                  className={`font-display text-4xl font-semibold ${
                    sheetTx.type === "expense" ? "text-negative" : sheetTx.type === "income" ? "text-positive" : "text-ink"
                  }`}
                >
                  {sheetTx.type === "expense" ? "-" : sheetTx.type === "income" ? "+" : ""}
                  {amount(sheetTx.amount)}
                </p>

                <dl className="mt-4 divide-y divide-line text-sm">
                  {(
                    [
                      ["Tanggal", dateLabel(sheetTx.transaction_at)],
                      ["Tipe", sheetTx.type === "expense" ? "Pengeluaran" : sheetTx.type === "income" ? "Pemasukan" : "Transfer"],
                      [sheetTx.type === "transfer" ? "Dompet asal" : "Dompet", walletById.get(sheetTx.wallet_id)?.name ?? shortID(sheetTx.wallet_id)],
                      sheetTx.type === "transfer" && sheetTx.destination_wallet_id
                        ? ["Dompet tujuan", walletById.get(sheetTx.destination_wallet_id)?.name ?? shortID(sheetTx.destination_wallet_id)]
                        : null,
                      sheetTx.type !== "transfer" ? ["Kategori", categoryById.get(sheetTx.category_id ?? "")?.name ?? "Belum dikategorikan"] : null,
                      ["Status", STATUS_LABEL[sheetTx.status] ?? sheetTx.status],
                      sheetTx.is_reimbursement
                        ? ["Reimbursement", sheetTx.reimbursement_status === "reimbursed" ? "Klaim lunas" : "Piutang, belum cair"]
                        : null,
                    ] as Array<[string, string] | null>
                  )
                    .filter((row): row is [string, string] => row !== null)
                    .map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                        <dt className="text-ink-soft">{label}</dt>
                        <dd className="min-w-0 truncate text-right font-semibold text-ink">{value}</dd>
                      </div>
                    ))}
                </dl>

                {sheetTx.note ? (
                  <p className="mt-3 rounded-xl border border-line bg-card p-3 text-sm text-ink">{sheetTx.note}</p>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDetail(null);
                      props.onEdit(sheetTx);
                    }}
                    className="btn-secondary flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="size-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetail(null);
                      void props.onDelete(sheetTx.id);
                    }}
                    className="btn-danger flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Hapus
                  </button>
                  {sheetTx.type === "expense" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDetail(null);
                        void toggleReimbursement(sheetTx);
                      }}
                      className="btn-secondary col-span-2"
                    >
                      {sheetTx.is_reimbursement ? "Batalkan piutang (belanja pribadi)" : "Tandai piutang (reimbursement)"}
                    </button>
                  ) : null}
                </div>
              </AppDialogBody>

              <AppDialogFooter className="flex-row gap-2 [&>*]:flex-1">
                <button
                  type="button"
                  disabled={sheetTx.status === "rejected"}
                  onClick={() => {
                    setDetail(null);
                    void props.onBulk([sheetTx.id], "rejected");
                  }}
                  className="btn-danger flex min-h-12 items-center justify-center gap-1.5 font-semibold"
                >
                  <X className="size-4" aria-hidden="true" />
                  Tolak
                </button>
                <button
                  type="button"
                  disabled={sheetTx.status === "needs_review"}
                  onClick={() => {
                    setDetail(null);
                    void props.onBulk([sheetTx.id], "needs_review");
                  }}
                  className="btn-secondary flex min-h-12 items-center justify-center gap-1.5 font-semibold"
                >
                  <Clock className="size-4" aria-hidden="true" />
                  Tinjau
                </button>
                <button
                  type="button"
                  disabled={sheetTx.status === "approved"}
                  onClick={() => {
                    setDetail(null);
                    void props.onBulk([sheetTx.id], "approved");
                  }}
                  className="btn-primary flex min-h-12 items-center justify-center gap-1.5"
                >
                  <Check className="size-4" aria-hidden="true" />
                  Setujui
                </button>
              </AppDialogFooter>
            </>
          ) : null}
        </AppDialogContent>
      </AppDialog>
    </InfoTooltipProvider>
  );
}
