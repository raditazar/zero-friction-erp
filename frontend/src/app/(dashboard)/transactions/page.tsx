"use client";

import { useEffect, useState, useMemo } from "react";
import { TransactionsView } from "@/components/dashboard/views/TransactionsView";
import { api, type Category, type Transaction, type TransactionStatus, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { ReviewDialog, type ReviewItem } from "@/components/ui/dialogs/review-dialog";
import { FormField, MoneyField, NativeSelectField, DateField, TextField } from "@/components/ui/form";

export default function TransactionsPage() {
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

  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Form States
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState("");
  const [txType, setTxType] = useState("expense");
  const [txWallet, setTxWallet] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txDesc, setTxDesc] = useState("");

  useEffect(() => {
    void api.wallets().then(setWallets).catch(console.error);
    void api.categories().then(setCategories).catch(console.error);
  }, []);

  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  async function performDelete(id: string) {
    await api.deleteTransaction(id);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setIsDeleteOpen(true);
  }

  async function performBulk(ids: string[], status: TransactionStatus) {
    await api.bulkUpdateTransactions({ ids, status });
    setRefreshKey((k) => k + 1);
  }

  async function handleBulk(ids: string[], status: TransactionStatus) {
    setBulkData({ ids, status });
    setIsBulkOpen(true);
  }

  function handleEdit(transaction: Transaction) {
    setEditingTx(transaction);
    setTxAmount(transaction.amount.toString());
    setTxDate(transaction.transaction_at.split("T")[0] || "");
    setTxType(transaction.type);
    setTxWallet(transaction.wallet_id);
    setTxCategory(transaction.category_id || "");
    setTxDesc(transaction.merchant || "");
    setIsFormOpen(true);
  }

  function handleNewTransfer() {
    setIsReviewOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // No domain logic change requested for form submission
    console.log("Submit transaction", { txAmount, txDate, txType, txWallet, txCategory, txDesc });
    setIsFormOpen(false);
  }

  const reviewItems: ReviewItem[] = [
    {
      id: "src",
      label: "Saldo Dompet A (Sumber)",
      before: 5000000,
      after: 4000000,
    },
    {
      id: "dst",
      label: "Saldo Dompet B (Tujuan)",
      before: 1000000,
      after: 2000000,
    }
  ];

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
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
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingTx ? "Edit Transaksi" : "Tambah Transaksi"}
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
            </NativeSelectField>
          </FormField>
          <FormField label="Jumlah" htmlFor="txAmount">
            <MoneyField id="txAmount" value={txAmount} onValueChange={setTxAmount} required />
          </FormField>
          <FormField label="Dompet" htmlFor="txWallet">
            <NativeSelectField id="txWallet" value={txWallet} onChange={e => setTxWallet(e.target.value)} required>
              <option value="" disabled>Pilih dompet...</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </NativeSelectField>
          </FormField>
          <FormField label="Kategori" htmlFor="txCategory">
            <NativeSelectField id="txCategory" value={txCategory} onChange={e => setTxCategory(e.target.value)}>
              <option value="">Pilih kategori...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelectField>
          </FormField>
          <FormField label="Deskripsi / Merchant" htmlFor="txDesc">
            <TextField id="txDesc" value={txDesc} onChange={e => setTxDesc(e.target.value)} />
          </FormField>
        </div>
      </FormDialog>

      <ReviewDialog
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        title="Review Transfer Antar Dompet"
        description="Periksa kembali dampak saldo sebelum mengkonfirmasi transfer."
        items={reviewItems}
        onConfirm={() => {
          console.log("Transfer confirmed");
          setIsReviewOpen(false);
        }}
      />

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
