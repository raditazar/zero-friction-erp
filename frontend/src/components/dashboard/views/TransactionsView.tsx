"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { api, type Category, type Transaction, type TransactionQuery, type TransactionStatus, type Wallet } from "@/lib/api";
import { statuses, transactionTypes } from "../model";
import { amount, cx, dateLabel, shortID } from "../formatters";
import { Fact, Panel } from "@/components/ui/dashboard";
import { MetricCard } from "@/components/ui/cards/metric-card";
import { NativeSelectField, SearchField } from "@/components/ui/form";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { ActionMenu } from "@/components/ui/action-menu";

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
};

export function TransactionsView(props: Props) {
  const { wallets, categories, walletById, categoryById, query, typeFilter, statusFilter, categoryFilter, walletFilter, refreshKey } = props;
  const [rows, setRows] = useState<Transaction[]>([]);
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
          {row.original.merchant || "Tanpa merchant"}
        </span>
      ),
    },
    {
      id: "wallet",
      header: "Dompet",
      cell: ({ row }) => (
        <span className="text-[#5A5A5A]">
          {walletById.get(row.original.wallet_id)?.name ?? shortID(row.original.wallet_id)}
        </span>
      ),
    },
    {
      id: "category",
      header: "Kategori",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-md bg-[#E8E5DF] px-2 py-0.5 text-xs font-medium text-[#1A1A1A]">
          {categoryById.get(row.original.category_id ?? "")?.name ?? "Belum dikategorikan"}
        </span>
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
        return (
          <span className={`font-mono tabular-nums font-semibold ${isExpense ? "text-[#A54B36]" : "text-[#2D5A27]"}`}>
            {isExpense ? "-" : "+"}{amount(row.original.amount)}
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
  }, [page, pageSize, activeSort.id, activeSort.desc, deferredQuery, typeFilter, statusFilter, categoryFilter, walletFilter, refreshKey]);

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

  return (
    <InfoTooltipProvider>
      <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
        <div className="panel-head mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="eyebrow text-[#5A5A5A]">Ledger Transaksi</p>
              <InfoTooltip content="Tabel ledger terverifikasi. Gunakan tombol panah keyboard untuk navigasi cepat." />
            </div>
            <h3 className="section-title text-[#1A1A1A] text-lg font-bold">
              Semua Catatan Transaksi
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {props.onNewTransaction && (
              <button className="btn-primary" onClick={props.onNewTransaction}>
                + Transaksi Baru
              </button>
            )}
            <button className="btn-primary" onClick={props.onNewTransfer}>
              + Transfer Antar Dompet
            </button>
          </div>
        </div>

        {/* Summary Metrics Grid */}
        <div className="mb-6 grid gap-4 grid-cols-1 md:grid-cols-3">
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

        {/* Filter Controls */}
        <div className="mb-4 grid gap-2 md:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(140px,1fr))]">
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
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-[#E5E2DC] px-4 py-2 text-sm text-[#1A1A1A]">
            <span className="font-semibold">{selected.size} transaksi terpilih</span>
            <button className="btn-compact bg-[#1A1A1A] text-[#FBF9F5]" onClick={() => void applyBulk("approved")}>Setujui</button>
            <button className="btn-compact bg-[#991B1B] text-[#FBF9F5]" onClick={() => void applyBulk("rejected")}>Tolak</button>
            <button className="btn-compact bg-[#D97706] text-[#FBF9F5]" onClick={() => void applyBulk("needs_review")}>Tinjau Ulang</button>
            <button className="btn-compact" onClick={() => setSelected(new Set())}>Batal</button>
          </div>
        ) : null}

        {loadError ? <p className="mb-4 text-sm font-medium text-[#DC2626]">{loadError}</p> : null}

        {/* Main Data Grid (DEC-01) */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div
            ref={gridRef}
            role="grid"
            aria-label="Ledger transaksi"
            aria-rowcount={total}
            onKeyDown={onGridKeyDown}
            className="hidden overflow-auto rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] shadow-sm lg:block"
          >
            <table className="min-w-[850px] w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-[#F0EEE9] text-xs font-bold uppercase tracking-wider text-[#5A5A5A] border-b border-[#E0DDD6]">
                <tr>
                  <th className="w-12 px-3 py-3 text-left">
                    <span className="sr-only">Pilih</span>
                  </th>
                  {table.getFlatHeaders().map((header) => (
                    <th key={header.id} className={cx("px-3 py-3 text-left", header.id === "amount" && "text-right")}>
                      <button
                        className="inline-flex items-center gap-1 font-semibold hover:text-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
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
              <tbody className="divide-y divide-[#F0EEE9]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-[#5A5A5A] font-medium">
                      Memuat data ledger...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-[#5A5A5A] font-medium">
                      Belum ada catatan transaksi yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row, rowIndex) => (
                    <tr
                      key={row.id}
                      className={cx(
                        "transition-colors hover:bg-[#F9F8F5]",
                        detail?.id === row.original.id && "bg-[#F0EEE9]"
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
                          className="h-4 w-4 rounded border-[#E0DDD6] accent-[#1A1A1A]"
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
                            className="w-full px-3 py-3 text-left outline-none hover:bg-[#F0EEE9]/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4F46E5]"
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

          {/* Mobile Fallback Cards */}
          <div className="grid gap-3 lg:hidden">
            {loading ? (
              <p className="py-8 text-center text-sm text-[#5A5A5A]">Memuat ledger…</p>
            ) : (
              rows.map((transaction) => (
                <button
                  key={transaction.id}
                  onClick={() => setDetail(transaction)}
                  className="rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] p-4 text-left shadow-sm focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#1A1A1A]">{transaction.merchant || "Tanpa merchant"}</p>
                      <p className="mt-1 text-xs text-[#5A5A5A]">
                        {dateLabel(transaction.transaction_at)} · {walletById.get(transaction.wallet_id)?.name ?? shortID(transaction.wallet_id)}
                      </p>
                    </div>
                    <span className={cx("font-bold tabular-nums", transaction.type === "income" ? "text-[#059669]" : "text-[#1A1A1A]")}>
                      {amount(transaction.amount)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Side Panel Detail (Legible Friction) */}
          <aside aria-live="polite" className="rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] p-5 shadow-sm">
            {detail ? (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-[#F0EEE9] pb-3">
                  <div>
                    <p className="eyebrow text-[#5A5A5A]">Detail Transaksi</p>
                    <h4 className="mt-1 font-bold text-lg text-[#1A1A1A]">{detail.merchant || "Tanpa merchant"}</h4>
                  </div>
                  <button className="link-button" onClick={() => setDetail(null)}>
                    Tutup
                  </button>
                </div>
                <dl className="mt-4 grid gap-3">
                  <Fact label="Tanggal" value={dateLabel(detail.transaction_at)} />
                  <Fact label="Dompet" value={walletById.get(detail.wallet_id)?.name ?? shortID(detail.wallet_id)} />
                  <Fact label="Kategori" value={categoryById.get(detail.category_id ?? "")?.name ?? "Belum dikategorikan"} />
                  <Fact label="Jumlah" value={amount(detail.amount)} />
                  <Fact label="Status" value={detail.status} />
                </dl>
                <div className="mt-6 flex justify-end pt-3 border-t border-[#F0EEE9]">
                  <ActionMenu
                    items={[
                      { label: "Setujui", onClick: () => void props.onBulk([detail.id], "approved") },
                      { label: "Tolak", onClick: () => void props.onBulk([detail.id], "rejected") },
                      { label: "Tinjau Ulang", onClick: () => void props.onBulk([detail.id], "needs_review") },
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
                <p className="text-sm font-medium text-[#5A5A5A]">Pilih transaksi untuk melihat detail lengkap.</p>
                <p className="mt-2 text-xs text-[#8C8C8C]">Gunakan navigasi panah keyboard dan tekan Enter pada grid.</p>
              </div>
            )}
          </aside>
        </div>

        {/* Pagination Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E0DDD6] pt-4 text-sm font-medium text-[#5A5A5A]">
          <span>
            Halaman <strong className="text-[#1A1A1A]">{page}</strong> dari <strong className="text-[#1A1A1A]">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[#5A5A5A]">
              Baris:
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-[#E0DDD6] bg-[#FFFFFF] px-2 py-1 text-xs text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#4F46E5]"
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
      </Panel>
    </InfoTooltipProvider>
  );
}
