"use client";

import { useEffect, useState, useMemo } from "react";
import { TransactionsView } from "@/components/dashboard/views/TransactionsView";
import { api, type Category, type Transaction, type TransactionPayload, type TransactionStatus, type TransactionType, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { PdfReportModal, type PdfReportTransaction } from "@/components/report/pdf-report-modal";

import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { FormField, MoneyField, NativeSelectField, DateField, TextField } from "@/components/ui/form";

import { ImportCsvDialog } from "@/components/ui/dialogs/import-csv-dialog";
import { downloadCSV, exportTransactionsToCSV } from "@/lib/csv-utils";
import { toast } from "@/components/ui/toast";

import { useSearchParams } from "next/navigation";

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [walletFilter, setWalletFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkData, setBulkData] = useState<{ ids: string[], status: TransactionStatus } | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);

  // PDF Report States
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfTransactions, setPdfTransactions] = useState<PdfReportTransaction[]>([]);
  const [pdfIncome, setPdfIncome] = useState(0);
  const [pdfExpense, setPdfExpense] = useState(0);
  const [pdfNet, setPdfNet] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Form States
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState("");
  const [txType, setTxType] = useState<string>("expense");
  const [txWallet, setTxWallet] = useState("");
  const [txDestWallet, setTxDestWallet] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txIsReimbursement, setTxIsReimbursement] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    void api.wallets().then((w) => {
      setWallets(w);
      if (w.length > 0) setTxWallet((current) => current || w[0].id);
    }).catch(console.error);
    void api.categories().then(setCategories).catch(console.error);
  }, []);

  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  async function performDelete(id: string) {
    try {
      await api.deleteTransaction(id);
      toast.success("Transaksi berhasil dihapus.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus transaksi.";
      toast.error("Gagal menghapus transaksi", { detail: msg });
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setIsDeleteOpen(true);
  }

  async function performBulk(ids: string[], status: TransactionStatus) {
    try {
      await api.bulkUpdateTransactions({ ids, status });
      toast.success(`Berhasil mengubah status ${ids.length} transaksi menjadi ${status}.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status transaksi.";
      toast.error("Gagal mengubah status transaksi", { detail: msg });
    }
  }

  async function handleBulk(ids: string[], status: TransactionStatus) {
    setBulkData({ ids, status });
    setIsBulkOpen(true);
  }

  const handleExportCsv = async () => {
    try {
      const res = await api.transactions({ page_size: 1000, sort: "transaction_at", order: "desc" });
      const csvStr = exportTransactionsToCSV(res.data, walletById, categoryById);
      const todayStr = new Date().toISOString().split("T")[0];
      downloadCSV(`transaksi_export_${todayStr}.csv`, csvStr);
      toast.success("Berhasil mengekspor CSV transaksi.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengekspor CSV. Silakan coba lagi.";
      console.error("Gagal mengekspor CSV transaksi:", err);
      toast.error("Gagal mengekspor CSV", { detail: msg });
    }
  };

  const handleExportPdf = async () => {
    setIsPdfOpen(true);
    setPdfLoading(true);
    try {
      const res = await api.transactions({ page_size: 100, sort: "transaction_at", order: "desc" });
      const txs = res.data;
      const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
      const catMap = new Map(categories.map((c) => [c.id, c.name]));

      let inc = 0;
      let exp = 0;
      const items: PdfReportTransaction[] = txs.map((t) => {
        const amt = typeof t.amount === "number" ? t.amount : parseFloat(String(t.amount)) || 0;
        if (t.type === "income") inc += amt;
        if (t.type === "expense") exp += amt;

        return {
          id: t.id,
          transaction_at: t.transaction_at,
          merchant: t.merchant,
          wallet_name: walletMap.get(t.wallet_id) || t.wallet_id.slice(0, 8),
          category_name: catMap.get(t.category_id || "") || "Belum dikategorikan",
          status: t.status,
          type: t.type,
          amount: amt,
        };
      });

      setPdfTransactions(items);
      setPdfIncome(inc);
      setPdfExpense(exp);
      setPdfNet(inc - exp);
      toast.success("Berhasil menyiapkan dokumen PDF transaksi.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat transaksi untuk PDF.";
      console.error("Gagal memuat transaksi untuk PDF:", err);
      toast.error("Gagal menyiapkan PDF transaksi", { detail: msg });
    } finally {
      setPdfLoading(false);
    }
  };

  function handleOpenNewForm() {
    setEditingTx(null);
    setTxAmount("");
    setTxDate(new Date().toISOString().split("T")[0]);
    setTxType("expense");
    setTxWallet(wallets[0]?.id || "");
    setTxDestWallet("");
    setTxCategory("");
    setTxDesc("");
    setTxIsReimbursement(false);
    setSubmitError("");
    setIsFormOpen(true);
  }

  function handleEdit(transaction: Transaction) {
    setEditingTx(transaction);
    setTxAmount(transaction.amount.toString());
    setTxDate(transaction.transaction_at.split("T")[0] || "");
    setTxType(transaction.type);
    setTxWallet(transaction.wallet_id);
    setTxDestWallet(transaction.destination_wallet_id || "");
    setTxCategory(transaction.category_id || "");
    setTxDesc(transaction.merchant || "");
    setTxIsReimbursement(Boolean(transaction.is_reimbursement));
    setSubmitError("");
    setIsFormOpen(true);
  }

  function handleNewTransfer() {
    setEditingTx(null);
    setTxAmount("");
    setTxDate(new Date().toISOString().split("T")[0]);
    setTxType("transfer");
    setTxWallet(wallets[0]?.id || "");
    setTxDestWallet(wallets[1]?.id || wallets[0]?.id || "");
    setTxCategory("");
    setTxDesc("");
    setTxIsReimbursement(false);
    setSubmitError("");
    setIsFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!txAmount || !txDate || !txWallet) {
      const msg = "Mohon lengkapi tanggal, nominal, dan dompet.";
      setSubmitError(msg);
      toast.error("Form belum lengkap", { detail: msg });
      return;
    }

    setSubmitBusy(true);
    setSubmitError("");
    try {
      const parsedAmount = parseFloat(txAmount) || 0;
      const isoDate = txDate ? new Date(txDate).toISOString() : new Date().toISOString();

      if (txType === "transfer") {
        if (!txDestWallet || txWallet === txDestWallet) {
          const msg = "Dompet asal dan dompet tujuan harus berbeda.";
          setSubmitError(msg);
          toast.error("Transfer tidak valid", { detail: msg });
          setSubmitBusy(false);
          return;
        }
        await api.createTransfer({
          wallet_id: txWallet,
          destination_wallet_id: txDestWallet,
          amount: parsedAmount,
          transaction_at: isoDate,
          note: txDesc || null,
          status: "approved",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        toast.success("Transfer antar dompet berhasil dibuat.");
      } else {
        const payload: TransactionPayload = {
          amount: parsedAmount,
          transaction_at: isoDate,
          type: txType as TransactionType,
          wallet_id: txWallet,
          category_id: txCategory || null,
          merchant: txDesc || null,
          is_reimbursement: txType === "expense" ? txIsReimbursement : false,
          reimbursement_status: txType === "expense" && txIsReimbursement ? (editingTx?.reimbursement_status && editingTx.reimbursement_status !== "none" ? editingTx.reimbursement_status : "receivable") : "none",
          status: "approved",
        };

        if (editingTx) {
          await api.patchTransaction(editingTx.id, payload);
          toast.success("Transaksi berhasil diperbarui.");
        } else {
          await api.createTransaction(payload);
          toast.success("Transaksi berhasil ditambahkan.");
        }
      }

      setIsFormOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan transaksi.";
      setSubmitError(msg);
      toast.error("Gagal menyimpan transaksi", { detail: msg });
    } finally {
      setSubmitBusy(false);
    }
  }

  useEffect(() => {
    if (actionParam === "new") {
      handleOpenNewForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionParam]);

  return (
    <div className="p-3 sm:p-6 bg-[#F7F6F2] min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
      <MobilePageHeader />
      <TransactionsView
        wallets={wallets}
        categories={categories}
        walletById={walletById}
        categoryById={categoryById}
        query={query}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        walletFilter={walletFilter}
        refreshKey={refreshKey}
        onTypeFilter={setTypeFilter}
        onStatusFilter={setStatusFilter}
        onCategoryFilter={setCategoryFilter}
        onWalletFilter={setWalletFilter}
        onQueryChange={setQuery}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulk={handleBulk}
        onNewTransfer={handleNewTransfer}
        onNewTransaction={handleOpenNewForm}
        onExportCSV={handleExportCsv}
        onImportCSV={() => setIsImportOpen(true)}
        onExportPDF={handleExportPdf}
      />

      <ImportCsvDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        wallets={wallets}
        categories={categories}
        onImportComplete={() => setRefreshKey((k) => k + 1)}
      />

      <PdfReportModal
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
        title="Laporan Transaksi Buku Besar"
        periodLabel="Catatan Transaksi Terkini"
        totalIncome={pdfIncome}
        totalExpense={pdfExpense}
        netCashflow={pdfNet}
        transactions={pdfTransactions}
        isLoading={pdfLoading}
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingTx ? "Edit Transaksi" : txType === "transfer" ? "Transfer Antar Dompet" : "Tambah Transaksi"}
        isSubmitting={submitBusy}
        submitError={submitError}
        onSubmit={handleFormSubmit}
      >
        <div className="grid gap-4 py-4">
          <FormField label="Tanggal" htmlFor="txDate">
            <DateField id="txDate" value={txDate} onChange={e => setTxDate(e.target.value)} required />
          </FormField>
          <FormField label="Tipe" htmlFor="txType">
            <NativeSelectField id="txType" value={txType} onChange={e => setTxType(e.target.value)} required>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer Antar Dompet</option>
            </NativeSelectField>
          </FormField>
          <FormField label="Jumlah" htmlFor="txAmount">
            <MoneyField id="txAmount" value={txAmount} onValueChange={setTxAmount} required />
          </FormField>
          <FormField label={txType === "transfer" ? "Dompet Asal" : "Dompet"} htmlFor="txWallet">
            <NativeSelectField id="txWallet" value={txWallet} onChange={e => setTxWallet(e.target.value)} required>
              <option value="" disabled>Pilih dompet...</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </NativeSelectField>
          </FormField>
          {txType === "transfer" && (
            <FormField label="Dompet Tujuan" htmlFor="txDestWallet">
              <NativeSelectField id="txDestWallet" value={txDestWallet} onChange={e => setTxDestWallet(e.target.value)} required>
                <option value="" disabled>Pilih dompet tujuan...</option>
                {wallets.filter(w => w.id !== txWallet).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </NativeSelectField>
            </FormField>
          )}
          {txType !== "transfer" && (
            <FormField label="Kategori" htmlFor="txCategory">
              <NativeSelectField id="txCategory" value={txCategory} onChange={e => setTxCategory(e.target.value)}>
                <option value="">Pilih kategori...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelectField>
            </FormField>
          )}
          <FormField label="Deskripsi / Catatan" htmlFor="txDesc">
            <TextField id="txDesc" value={txDesc} onChange={e => setTxDesc(e.target.value)} />
          </FormField>
          {txType === "expense" && (
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-lg border border-[#E8E6E1] bg-[#FAF9F5] p-3 transition hover:bg-[#F3F2EB]">
                <input
                  type="checkbox"
                  id="txIsReimbursement"
                  checked={txIsReimbursement}
                  onChange={(e) => setTxIsReimbursement(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1A1A1A] focus:ring-black"
                />
                <div>
                  <span className="block text-sm font-semibold text-[#1A1A1A]">
                    Tandai sebagai Reimbursement (Piutang)
                  </span>
                  <span className="block text-xs text-[#6E6D7A]">
                    Pengeluaran ini tidak akan memotong anggaran belanja pribadi dan dicatat sebagai klaim piutang untuk ditagihkan nanti.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>
      </FormDialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Transaksi Buku Besar?"
        description="Tindakan ini tidak dapat dibatalkan dan akan mempengaruhi saldo."
        variant="danger"
        onConfirm={async () => {
          if (deletingId) {
            await performDelete(deletingId);
          }
          setIsDeleteOpen(false);
        }}
      />

      <ConfirmDialog
        open={isBulkOpen}
        onOpenChange={setIsBulkOpen}
        title="Konfirmasi Tindakan Massal"
        description={`Anda akan mengubah status ${bulkData?.ids.length} transaksi menjadi ${bulkData?.status}. Lanjutkan?`}
        variant="warning"
        onConfirm={async () => {
          if (bulkData) {
            await performBulk(bulkData.ids, bulkData.status);
          }
          setIsBulkOpen(false);
        }}
      />
    </div>
  );
}

