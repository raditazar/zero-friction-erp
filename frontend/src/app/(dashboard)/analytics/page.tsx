"use client";

import { useEffect, useState } from "react";
import { AnalyticsView } from "@/components/dashboard/views/AnalyticsView";
import { api, type AnalyticsSummary, type CashflowPoint, type SpendingPoint } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { LoadingState, ErrorState } from "@/components/ui/feedback";
import { PdfReportModal, type PdfReportTransaction } from "@/components/report/pdf-report-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, FileSpreadsheet, FileText } from "lucide-react";

import { downloadCSV, exportAnalyticsSummaryToCSV } from "@/lib/csv-utils";
import { toast } from "@/components/ui/toast";

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [spendingCategories, setSpendingCategories] = useState<SpendingPoint[]>([]);
  const [spendingTags, setSpendingTags] = useState<SpendingPoint[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDF Report States
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfTransactions, setPdfTransactions] = useState<PdfReportTransaction[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: formatDate(firstDay),
      to: formatDate(today)
    };
  });
  const [activePill, setActivePill] = useState("Bulan Ini");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
     
    setError(null);
    Promise.all([
      api.analyticsSummary(dateRange),
      api.analyticsCashflow(dateRange),
      api.analyticsSpendingByCategory(dateRange),
      api.analyticsSpendingByTags(dateRange),
    ])
      .then(([s, c, cat, tag]) => {
        setSummary(s);
        setCashflow(c);
        setSpendingCategories(cat);
        setSpendingTags(tag);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load analytics");
        setIsLoading(false);
      });
  }, [dateRange]);

  const handleExportCsv = () => {
    try {
      const csvStr = exportAnalyticsSummaryToCSV(summary, spendingCategories, spendingTags, dateRange);
      downloadCSV(`analisis_keuangan_${dateRange.from}_${dateRange.to}.csv`, csvStr);
      toast.success("Berhasil mengekspor Laporan Analisis Keuangan CSV.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengekspor Laporan Analisis.";
      toast.error("Gagal mengekspor CSV Analitik", { detail: msg });
    }
  };

  const handleExportPdf = async () => {
    setIsPdfOpen(true);
    setPdfLoading(true);
    try {
      const [txRes, wList, cList] = await Promise.all([
        api.transactions({ from: dateRange.from, to: dateRange.to, page_size: 100, sort: "transaction_at", order: "desc" }),
        api.wallets().catch(() => []),
        api.categories().catch(() => []),
      ]);

      const walletMap = new Map(wList.map((w) => [w.id, w.name]));
      const catMap = new Map(cList.map((c) => [c.id, c.name]));

      const items: PdfReportTransaction[] = txRes.data.map((t) => ({
        id: t.id,
        transaction_at: t.transaction_at,
        merchant: t.merchant,
        wallet_name: walletMap.get(t.wallet_id) || t.wallet_id.slice(0, 8),
        category_name: catMap.get(t.category_id || "") || "Belum dikategorikan",
        status: t.status,
        type: t.type,
        amount: typeof t.amount === "number" ? t.amount : parseFloat(String(t.amount)) || 0,
      }));

      setPdfTransactions(items);
      toast.success("Siap mencetak Laporan Analisis Keuangan PDF.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat transaksi untuk PDF.";
      console.error("Gagal memuat transaksi untuk PDF:", err);
      toast.error("Gagal menyiapkan PDF Laporan Analitik", { detail: msg });
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePillClick = (pill: string) => {
    setActivePill(pill);
    if (pill === "Kustom") {
      return;
    }
    const today = new Date();
    let from = dateRange.from;
    const to = formatDate(today);
    
    if (pill === "7 Hari") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      from = formatDate(d);
    } else if (pill === "30 Hari") {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      from = formatDate(d);
    } else if (pill === "Bulan Ini") {
      from = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (pill === "YTD") {
      from = formatDate(new Date(today.getFullYear(), 0, 1));
    }
    setDateRange({ from, to });
  };

  return (
    <div className="page-shell">
      <MobilePageHeader />
      
      <div className="mb-4 sm:mb-6 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Horizontal Period Chips */}
          <div className="bg-paper-sunk p-1 rounded-xl flex items-center gap-1 overflow-x-auto max-w-full">
            {["7 Hari", "30 Hari", "Bulan Ini", "YTD", "Kustom"].map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => handlePillClick(pill)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  activePill === pill
                    ? "bg-card shadow-xs text-ink font-semibold"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-xl border border-line bg-card text-ink hover:bg-paper transition-colors shadow-xs shrink-0"
              >
                <span>Ekspor</span>
                <ChevronDown className="w-3.5 h-3.5 text-ink-soft" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border border-line shadow-md rounded-xl p-1 min-w-[140px]">
              <DropdownMenuItem
                onClick={handleExportCsv}
                className="text-xs sm:text-sm px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-paper focus:bg-paper flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-ink-soft" />
                <span>Ekspor CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportPdf}
                className="text-xs sm:text-sm px-3 py-2 rounded-lg cursor-pointer text-ink hover:bg-paper focus:bg-paper flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-ink-soft" />
                <span>Ekspor PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Custom Date Range Selector */}
        {activePill === "Kustom" && (
          <div className="flex flex-wrap items-end gap-2 text-xs text-ink">
            <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-soft">Dari</span>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => {
                setDateRange((r) => ({ ...r, from: e.target.value }));
                setActivePill("Kustom");
              }}
              className="bg-card border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none focus:border-ink shadow-xs"
            />
            </label>
            <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-soft">Sampai</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => {
                setDateRange((r) => ({ ...r, to: e.target.value }));
                setActivePill("Kustom");
              }}
              className="bg-card border border-line rounded-lg px-3 py-1.5 text-xs text-ink outline-none focus:border-ink shadow-xs"
            />
            </label>
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState label="Mengambil data untuk periode yang dipilih..." />
      ) : error ? (
        <ErrorState title="Gagal memuat Analytics" message={error} onRetry={() => setDateRange({ ...dateRange })} />
      ) : (
        <AnalyticsView
          summary={summary}
          cashflow={cashflow}
          spendingCategories={spendingCategories}
          spendingTags={spendingTags}
          monthLabel={`${dateRange.from} s/d ${dateRange.to}`}
        />
      )}

      <PdfReportModal
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
        title="Laporan Analisis Keuangan"
        periodLabel={`${dateRange.from} s/d ${dateRange.to}`}
        totalIncome={typeof summary?.income === "number" ? summary.income : parseFloat(String(summary?.income || 0))}
        totalExpense={typeof summary?.expense === "number" ? summary.expense : parseFloat(String(summary?.expense || 0))}
        netCashflow={typeof summary?.net_cashflow === "number" ? summary.net_cashflow : parseFloat(String(summary?.net_cashflow || 0))}
        transactions={pdfTransactions}
        isLoading={pdfLoading}
      />
    </div>
  );
}
