"use client";

import { useEffect, useState, useMemo } from "react";
import { TransactionsView } from "@/components/dashboard/views/TransactionsView";
import { api, type Category, type Transaction, type TransactionStatus, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";


export default function TransactionsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [walletFilter, setWalletFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    void api.wallets().then(setWallets).catch(console.error);
    void api.categories().then(setCategories).catch(console.error);
  }, []);

  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  async function handleDelete(id: string) {
    await api.deleteTransaction(id);
    setRefreshKey((k) => k + 1);
  }

  async function handleBulk(ids: string[], status: TransactionStatus) {
    await api.bulkUpdateTransactions({ ids, status });
    setRefreshKey((k) => k + 1);
  }

  function handleEdit(transaction: Transaction) {
    // Navigate or open modal for transaction editing
    console.log("Edit transaction:", transaction);
  }

  function handleNewTransfer() {
    console.log("New transfer modal trigger");
  }

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
    </div>
  );
}
