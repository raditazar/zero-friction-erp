"use client";

import { useEffect, useState } from "react";
import { AnalyticsView } from "@/components/dashboard/views/AnalyticsView";
import { api, type AnalyticsSummary, type CashflowPoint, type SpendingPoint } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { LoadingState, ErrorState } from "@/components/ui/feedback";
import { PdfReportModal, type PdfReportTransaction } from "@/components/report/pdf-report-modal";

import { downloadCSV, escapeCSVField } from "@/lib/csv-utils";

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
    const csvRows: string[] = [];
    csvRows.push("Ringkasan Analisis Keuangan");
    csvRows.push(`Periode,${dateRange.from} s/d ${dateRange.to}`);
    if (summary) {
      csvRows.push(`Total Pemasukan,${summary.income}`);
      csvRows.push(`Total Pengeluaran,${summary.expense}`);
      csvRows.push(`Net Cashflow,${summary.net_cashflow}`);
    }
    csvRows.push("");
    csvRows.push("Cashflow Harian");
    csvRows.push("Tanggal,Pemasukan,Pengeluaran");
    cashflow.forEach((c) => {
      csvRows.push(`${escapeCSVField(c.day)},${escapeCSVField(c.income)},${escapeCSVField(c.expense)}`);
    });
    csvRows.push("");
    csvRows.push("Pengeluaran Berdasarkan Kategori");
    csvRows.push("Kategori,Jumlah");
    spendingCategories.forEach((s) => {
      csvRows.push(`${escapeCSVField(s.name || "Belum Dikategorikan")},${escapeCSVField(s.amount)}`);
    });
    csvRows.push("");
    csvRows.push("Pengeluaran Berdasarkan Tag");
    csvRows.push("Tag,Jumlah");
    spendingTags.forEach((t) => {
      csvRows.push(`${escapeCSVField(t.name || "Tanpa Tag")},${escapeCSVField(t.amount)}`);
    });

    downloadCSV(`analytics_export_${dateRange.from}_${dateRange.to}.csv`, csvRows.join("\n"));
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
    } catch (err) {
      console.error("Gagal memuat transaksi untuk PDF:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePillClick = (pill: string) => {
    setActivePill(pill);
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
    <div className="p-4 sm:p-6 bg-[#F4F3EE] min-h-screen">
      <MobilePageHeader
        secondaryCta={{ label: "Ekspor PDF", onClick: handleExportPdf }}
        secondaryActions={[
          { label: "Ekspor CSV", onClick: handleExportCsv }
        ]}
      />
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">Analytics Dashboard</h1>
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-[#E8E6E1] p-1 rounded-lg">
              {["7 Hari", "30 Hari", "Bulan Ini", "YTD"].map((pill) => (
                <button
                  key={pill}
                  onClick={() => handlePillClick(pill)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activePill === pill ? "bg-white shadow-sm text-black" : "text-[#5A5A5A] hover:text-black"
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-[#5A5A5A]">
              <input 
                type="date" 
                value={dateRange.from} 
                onChange={(e) => {
                  setDateRange(r => ({ ...r, from: e.target.value }));
                  setActivePill("");
                }}
                className="bg-white border border-[#E8E6E1] outline-none focus:border-[#1A1A1A] rounded-md px-3 py-1.5 shadow-sm"
              />
              <span>-</span>
              <input 
                type="date" 
                value={dateRange.to} 
                onChange={(e) => {
                  setDateRange(r => ({ ...r, to: e.target.value }));
                  setActivePill("");
                }}
                className="bg-white border border-[#E8E6E1] outline-none focus:border-[#1A1A1A] rounded-md px-3 py-1.5 shadow-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-secondary text-sm px-3.5 py-1.5 font-medium rounded-md border border-[#E8E6E1] bg-white text-[#1A1A1A] hover:bg-[#F9F8F5] transition-colors shadow-sm"
          >
            Ekspor CSV
          </button>
        </div>
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
