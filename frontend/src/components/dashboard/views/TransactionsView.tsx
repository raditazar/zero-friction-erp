"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ArrowLeftRight,
  SlidersHorizontal,
  X,
  Check,
  Clock,
  Edit3,
  Trash2,
} from "lucide-react";
import { api, type Category, type Transaction, type TransactionQuery, type TransactionStatus, type Wallet } from "@/lib/api";
import { statuses, transactionTypes } from "../model";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { Fact } from "@/components/ui/dashboard";
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
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

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
        <span className="tabular-nums font-medium text-[#1A1A1A]">
          {dateLabel(row.original.transaction_at)}
        </span>
      ),
    },
    {
      id: "merchant",
      header: "Merchant",
      cell: ({ row }) => (
        <span className="font-semibold text-[#1A1A1A]">
          {row.original.merchant || (row.original.type === "transfer" ? "Transfer Antar Dompet" : "Tanpa merchant")}
        </span>
      ),
    },
    {
      id: "wallet",
      header: "Dompet",
      cell: ({ row }) => (
        <span className="text-[#5A5A5A]">
          {walletById.get(row.original.wallet_id)?.name ?? shortID(row.original.wallet_id)}
          {row.original.type === "transfer" && row.original.destination_wallet_id && (
            ` → ${walletById.get(row.original.destination_wallet_id)?.name ?? shortID(row.original.destination_wallet_id)}`
          )}
        </span>
      ),
    },
    {
      id: "category",
      header: "Kategori",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center rounded-md bg-[#E8E5DF] px-2 py-0.5 text-xs font-medium text-[#1A1A1A]">
            {categoryById.get(row.original.category_id ?? "")?.name ?? "Belum dikategorikan"}
          </span>
          {row.original.is_reimbursement && (
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                row.original.reimbursement_status === "reimbursed"
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                  : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
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
            ? "bg-[#D1FAE5] text-[#065F46]"
            : s === "needs_review"
            ? "bg-[#FEF3C7] text-[#92400E]"
            : "bg-[#FEE2E2] text-[#991B1B]";
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
              isExpense ? "text-[#A54B36]" : isIncome ? "text-[#2D5A27]" : "text-[#1A1A1A]"
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

  async function applyBulk(status: TransactionStatus) {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Ubah status ${ids.length} transaksi di halaman ini menjadi ${status}?`)) return;
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
              <p className="eyebrow text-[#756f64]">Ledger Transaksi</p>
              <InfoTooltip content="Tabel ledger terverifikasi. Gunakan tombol panah keyboard untuk navigasi cepat." />
            </div>
            <h3 className="section-title text-[#1A1A1A] text-xl font-bold">
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
              <span className="truncate">+ Transaksi</span>
            </button>
          )}
          <button
            className="btn-secondary flex-1 py-2.5 px-3 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 rounded-xl truncate"
            onClick={props.onNewTransfer}
          >
            <ArrowLeftRight className="size-3.5 shrink-0" />
            <span className="truncate">Transfer</span>
          </button>
          <div className="shrink-0 bg-white border border-[#E8E6E1] rounded-xl flex items-center justify-center p-1 shadow-sm">
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
        <div className="lg:hidden bg-white border border-[#E8E6E1] rounded-xl p-3 shadow-sm">
          <div className="grid grid-cols-3 divide-x divide-[#E8E6E1] text-center">
            <div className="px-1 min-w-0">
              <p className="text-[11px] font-medium text-[#756f64] truncate">Masuk</p>
              <p className="text-xs sm:text-sm font-bold text-[#2D5A27] tabular-nums truncate mt-0.5">
                +{amount(totalIncome)}
              </p>
            </div>
            <div className="px-1 min-w-0">
              <p className="text-[11px] font-medium text-[#756f64] truncate">Keluar</p>
              <p className="text-xs sm:text-sm font-bold text-[#A54B36] tabular-nums truncate mt-0.5">
                -{amount(totalExpense)}
              </p>
            </div>
            <div className="px-1 min-w-0">
              <p className="text-[11px] font-medium text-[#756f64] truncate">Net Cashflow</p>
              <p className={cx("text-xs sm:text-sm font-bold tabular-nums truncate mt-0.5", netCashflow >= 0 ? "text-[#2D5A27]" : "text-[#A54B36]")}>
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
                ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                : "bg-white text-[#1A1A1A] border-[#E8E6E1] hover:bg-[#FAF9F5]"
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
                    ? "bg-[#1A1A1A] text-white shadow-sm"
                    : "bg-white border border-[#E8E6E1] text-[#756f64] hover:text-[#1A1A1A] hover:bg-[#FAF9F5]"
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
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white border border-[#E8E6E1] p-3 text-sm text-[#1A1A1A] shadow-sm">
            <span className="font-semibold">{selected.size} transaksi terpilih</span>
            <button className="btn-compact bg-[#1A1A1A] text-[#FBF9F5] rounded-lg" onClick={() => void applyBulk("approved")}>Setujui</button>
            <button className="btn-compact bg-[#991B1B] text-[#FBF9F5] rounded-lg" onClick={() => void applyBulk("rejected")}>Tolak</button>
            <button className="btn-compact bg-[#D97706] text-[#FBF9F5] rounded-lg" onClick={() => void applyBulk("needs_review")}>Tinjau Ulang</button>
            <button className="btn-compact rounded-lg" onClick={() => setSelected(new Set())}>Batal</button>
          </div>
        ) : null}

        {loadError ? <p className="text-sm font-medium text-[#DC2626]">{loadError}</p> : null}

        {/* Main Content Layout (Desktop Grid & Mobile List) */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem] min-w-0 w-full">
          {/* Desktop Table View (lg:block) */}
          <div
            ref={gridRef}
            role="grid"
            aria-label="Ledger transaksi"
            aria-rowcount={total}
            onKeyDown={onGridKeyDown}
            className="hidden overflow-x-auto rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] shadow-sm lg:block"
          >
            <table className="min-w-[850px] w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-[#FAF9F5] text-xs font-bold uppercase tracking-wider text-[#756f64] border-b border-[#E8E6E1]">
                <tr>
                  <th className="w-12 px-3 py-3 text-left">
                    <span className="sr-only">Pilih</span>
                  </th>
                  {table.getFlatHeaders().map((header) => (
                    <th key={header.id} className={cx("px-3 py-3 text-left", header.id === "amount" && "text-right")}>
                      <button
                        className="inline-flex items-center gap-1 font-semibold hover:text-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A]"
                        disabled={!sortable.has(header.id)}
                        onClick={() => header.column.toggleSorting(header.column.getIsSorted() === "asc")}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() ? (header.column.getIsSorted() === "asc" ? " ↑" : " ↓") : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E6E1]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-[#756f64] font-medium">
                      Memuat data ledger...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-[#756f64] font-medium">
                      Belum ada catatan transaksi yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row, rowIndex) => (
                    <tr
                      key={row.id}
                      className={cx(
                        "transition-colors hover:bg-[#FAF9F5]",
                        detail?.id === row.original.id && "bg-[#FAF9F5]"
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
                          className="h-4 w-4 rounded border-[#E8E6E1] accent-[#1A1A1A]"
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
                            className="w-full px-3 py-3 text-left outline-none hover:bg-[#FAF9F5] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1A1A1A]"
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
            {loading ? (
              <div className="py-12 text-center text-sm text-[#756f64] bg-white rounded-xl border border-[#E8E6E1] p-6 shadow-sm">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#1A1A1A] border-t-transparent mb-2" />
                <p>Memuat catatan transaksi...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#756f64] bg-white rounded-xl border border-[#E8E6E1] p-6 shadow-sm">
                <p className="font-medium text-[#1A1A1A]">Belum ada transaksi</p>
                <p className="mt-1 text-xs text-[#756f64]">Tidak ada catatan transaksi yang sesuai dengan filter.</p>
              </div>
            ) : (
              dateGroups.map((group) => (
                <div key={group.dateKey} className="space-y-1.5 w-full min-w-0">
                  {/* Date Group Header */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-[#756f64] tracking-wide">
                      {group.formattedDate}
                    </span>
                    <span className="text-[11px] font-medium text-[#756f64]">
                      {group.transactions.length} transaksi
                    </span>
                  </div>

                  {/* Group Items Container */}
                  <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden divide-y divide-[#E8E6E1] shadow-sm w-full min-w-0">
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
                          className="w-full p-3.5 flex items-center justify-between gap-3 text-left transition-colors active:bg-[#FAF9F5] hover:bg-[#FAF9F5] focus-visible:outline-none focus-visible:bg-[#FAF9F5] min-w-0"
                        >
                          {/* Left: Avatar & Info */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="bg-[#FAF9F5] border border-[#E8E6E1] text-[#1A1A1A] font-bold text-xs rounded-xl size-10 flex items-center justify-center shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-[#1A1A1A] truncate leading-tight">
                                {transaction.merchant || (isTransfer ? `Transfer: ${walletName} → ${destWalletName || "Dompet Lain"}` : "Tanpa merchant")}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-[#756f64] truncate">
                                <span className="truncate">
                                  {isTransfer ? `${walletName} → ${destWalletName}` : walletName}
                                </span>
                                {categoryName && (
                                  <>
                                    <span className="text-[#E8E6E1] shrink-0">·</span>
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
                                  ? "text-[#A54B36]"
                                  : isIncome
                                  ? "text-[#2D5A27]"
                                  : "text-[#1A1A1A]"
                              }`}
                            >
                              {isExpense ? "-" : isIncome ? "+" : ""}
                              {amount(transaction.amount)}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              {transaction.is_reimbursement && (
                                <span
                                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                    transaction.reimbursement_status === "reimbursed"
                                      ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]"
                                      : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
                                  }`}
                                >
                                  {transaction.reimbursement_status === "reimbursed" ? "Klaim Lunas" : "Piutang"}
                                </span>
                              )}
                              {transaction.status !== "approved" && (
                                <span
                                  className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-medium ${
                                    transaction.status === "needs_review"
                                      ? "bg-[#FEF3C7] text-[#92400E]"
                                      : "bg-[#FEE2E2] text-[#991B1B]"
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
          </div>

          {/* Desktop Side Panel Detail (hidden lg:block) */}
          <aside aria-live="polite" className="hidden lg:block rounded-xl border border-[#E8E6E1] bg-[#FFFFFF] p-5 shadow-sm">
            {detail ? (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-[#FAF9F5] pb-3">
                  <div>
                    <p className="eyebrow text-[#756f64]">Detail Transaksi</p>
                    <h4 className="mt-1 font-bold text-lg text-[#1A1A1A]">{detail.merchant || (detail.type === "transfer" ? "Transfer Antar Dompet" : "Tanpa merchant")}</h4>
                  </div>
                  <button className="link-button text-xs font-semibold text-[#756f64] hover:text-[#1A1A1A]" onClick={() => setDetail(null)}>
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
                <div className="mt-6 flex justify-end pt-3 border-t border-[#FAF9F5]">
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
                                  await props.onBulk([], "approved");
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
                        onClick: () => {
                          if (window.confirm("Hapus transaksi ini dari ledger?")) void props.onDelete(detail.id);
                        }
                      }
                    ]}
                  />
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-[#756f64]">Pilih transaksi untuk melihat detail lengkap.</p>
                <p className="mt-2 text-xs text-[#756f64]">Gunakan navigasi panah keyboard dan tekan Enter pada grid.</p>
              </div>
            )}
          </aside>
        </div>

        {/* Pagination Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E8E6E1] pt-4 text-xs sm:text-sm font-medium text-[#756f64]">
          <span>
            Halaman <strong className="text-[#1A1A1A]">{page}</strong> dari <strong className="text-[#1A1A1A]">{totalPages}</strong> ({total} total transaksi)
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[#756f64]">
              Baris:
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-[#E8E6E1] bg-[#FFFFFF] px-2 py-1 text-xs text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#1A1A1A]"
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
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">Dompet</label>
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
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">Status Verifikasi</label>
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
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">Kategori</label>
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
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">Jenis Piutang / Belanja</label>
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

      {/* Mobile Slide-Up Bottom Sheet Detail Transaksi (lg:hidden) */}
      <AnimatePresence>
        {detail && (
          <div className="fixed inset-0 z-50 lg:hidden flex items-end justify-center pointer-events-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDetail(null)}
              className="fixed inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm pointer-events-auto"
            />

            {/* Slide-Up Panel */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-lg bg-[#FFFFFF] rounded-t-2xl border-t border-[#E8E6E1] shadow-2xl p-5 max-h-[85vh] overflow-y-auto pointer-events-auto flex flex-col min-w-0"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-[#DCD8D1] rounded-full mx-auto mb-3 shrink-0" />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#FAF9F5]">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#756f64] uppercase tracking-wider">Detail Transaksi</p>
                  <h4 className="text-base sm:text-lg font-bold text-[#1A1A1A] truncate mt-0.5">
                    {detail.merchant || (detail.type === "transfer" ? "Transfer Antar Dompet" : "Tanpa Merchant")}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-full p-1.5 text-[#756f64] hover:bg-[#FAF9F5] hover:text-[#1A1A1A] transition-colors shrink-0"
                  aria-label="Tutup detail"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Amount Highlight */}
              <div className="my-4 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E8E6E1] text-center">
                <p className="text-xs font-medium text-[#756f64] mb-1">Nominal Transaksi</p>
                <p
                  className={`font-mono text-2xl font-bold tabular-nums ${
                    detail.type === "expense"
                      ? "text-[#A54B36]"
                      : detail.type === "income"
                      ? "text-[#2D5A27]"
                      : "text-[#1A1A1A]"
                  }`}
                >
                  {detail.type === "expense" ? "-" : detail.type === "income" ? "+" : ""}
                  {amount(detail.amount)}
                </p>
              </div>

              {/* Detail Facts */}
              <dl className="grid gap-2.5 text-sm">
                <div className="flex items-center justify-between py-1 border-b border-[#FAF9F5]">
                  <dt className="text-xs text-[#756f64]">Tanggal</dt>
                  <dd className="text-xs font-semibold text-[#1A1A1A]">{dateLabel(detail.transaction_at)}</dd>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#FAF9F5]">
                  <dt className="text-xs text-[#756f64]">Tipe</dt>
                  <dd className="text-xs font-semibold text-[#1A1A1A] capitalize">
                    {detail.type === "expense" ? "Pengeluaran" : detail.type === "income" ? "Pemasukan" : "Transfer"}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#FAF9F5]">
                  <dt className="text-xs text-[#756f64]">{detail.type === "transfer" ? "Dompet Asal" : "Dompet"}</dt>
                  <dd className="text-xs font-semibold text-[#1A1A1A]">
                    {walletById.get(detail.wallet_id)?.name ?? shortID(detail.wallet_id)}
                  </dd>
                </div>
                {detail.type === "transfer" && detail.destination_wallet_id && (
                  <div className="flex items-center justify-between py-1 border-b border-[#FAF9F5]">
                    <dt className="text-xs text-[#756f64]">Dompet Tujuan</dt>
                    <dd className="text-xs font-semibold text-[#1A1A1A]">
                      {walletById.get(detail.destination_wallet_id)?.name ?? shortID(detail.destination_wallet_id)}
                    </dd>
                  </div>
                )}
                {detail.type !== "transfer" && (
                  <div className="flex items-center justify-between py-1 border-b border-[#FAF9F5]">
                    <dt className="text-xs text-[#756f64]">Kategori</dt>
                    <dd className="text-xs font-semibold text-[#1A1A1A]">
                      {categoryById.get(detail.category_id ?? "")?.name ?? "Belum dikategorikan"}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between py-1 border-b border-[#FAF9F5]">
                  <dt className="text-xs text-[#756f64]">Status</dt>
                  <dd>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        detail.status === "approved"
                          ? "bg-[#D1FAE5] text-[#065F46]"
                          : detail.status === "needs_review"
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#FEE2E2] text-[#991B1B]"
                      }`}
                    >
                      {detail.status}
                    </span>
                  </dd>
                </div>
                {detail.is_reimbursement && (
                  <div className="flex items-center justify-between py-1 border-b border-[#FAF9F5]">
                    <dt className="text-xs text-[#756f64]">Piutang / Reimbursement</dt>
                    <dd className="text-xs font-semibold text-[#92400E]">
                      {detail.reimbursement_status === "reimbursed" ? "Klaim Lunas" : "Piutang (Belum Cair)"}
                    </dd>
                  </div>
                )}
                {detail.note && (
                  <div className="flex flex-col gap-1 py-1">
                    <dt className="text-xs text-[#756f64]">Catatan</dt>
                    <dd className="text-xs text-[#1A1A1A] bg-[#FAF9F5] p-2.5 rounded-lg border border-[#E8E6E1]">
                      {detail.note}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Action Buttons Grid */}
              <div className="mt-5 pt-3 border-t border-[#FAF9F5] space-y-2">
                <p className="text-[11px] font-semibold text-[#756f64] uppercase tracking-wider mb-2">Tindakan Transaksi</p>
                
                {/* Status Quick Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={detail.status === "approved"}
                    onClick={async () => {
                      await props.onBulk([detail.id], "approved");
                      setDetail(null);
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                      detail.status === "approved"
                        ? "bg-[#D1FAE5] text-[#065F46] opacity-60 cursor-not-allowed"
                        : "bg-[#1A1A1A] text-white hover:bg-black"
                    }`}
                  >
                    <Check className="size-3.5" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    disabled={detail.status === "needs_review"}
                    onClick={async () => {
                      await props.onBulk([detail.id], "needs_review");
                      setDetail(null);
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                      detail.status === "needs_review"
                        ? "bg-[#FEF3C7] text-[#92400E] opacity-60 cursor-not-allowed"
                        : "bg-[#D97706] text-white hover:bg-[#B45309]"
                    }`}
                  >
                    <Clock className="size-3.5" />
                    Tinjau
                  </button>
                  <button
                    type="button"
                    disabled={detail.status === "rejected"}
                    onClick={async () => {
                      await props.onBulk([detail.id], "rejected");
                      setDetail(null);
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                      detail.status === "rejected"
                        ? "bg-[#FEE2E2] text-[#991B1B] opacity-60 cursor-not-allowed"
                        : "bg-[#991B1B] text-white hover:bg-[#7F1D1D]"
                    }`}
                  >
                    <X className="size-3.5" />
                    Tolak
                  </button>
                </div>

                {/* Secondary Actions */}
                {detail.type === "expense" && (
                  <button
                    type="button"
                    onClick={async () => {
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
                        await props.onBulk([], "approved");
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Gagal mengubah status.";
                        toast.error("Gagal mengubah status reimbursement", { detail: msg });
                      }
                    }}
                    className="w-full py-2.5 px-3 text-xs font-semibold rounded-lg border border-[#E8E6E1] bg-white text-[#1A1A1A] hover:bg-[#FAF9F5] transition-colors"
                  >
                    {detail.is_reimbursement ? "Batalkan Piutang (Belanja Pribadi)" : "Tandai Piutang (Reimbursement)"}
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const current = detail;
                      setDetail(null);
                      props.onEdit(current);
                    }}
                    className="py-2.5 px-3 text-xs font-semibold rounded-lg border border-[#E8E6E1] bg-white text-[#1A1A1A] hover:bg-[#FAF9F5] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="size-3.5" />
                    Edit Detail
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idToDelete = detail.id;
                      setDetail(null);
                      void props.onDelete(idToDelete);
                    }}
                    className="py-2.5 px-3 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                    Hapus
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="w-full py-2.5 text-xs font-semibold text-[#756f64] hover:text-[#1A1A1A] transition-colors mt-2"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </InfoTooltipProvider>
  );
}
