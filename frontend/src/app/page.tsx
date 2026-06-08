"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, APIKey, AnalyticsRange, AnalyticsSummary, CashflowPoint, Category, DeadLetter, Me, RecurringRule, SavingGoal, SinkingFund, SpendingPoint, Tag, Transaction, TransactionStatus, TransactionType, Wallet, WalletBalance, WebhookEvent, WebhookToken } from "@/lib/api";
import { LoginScreen } from "@/components/dashboard/LoginScreen";
import { AllocationDialog, HelpDialog, TransactionDialog } from "@/components/dashboard/dialogs";
import { cx, draftToPayload, transactionToDraft } from "@/components/dashboard/formatters";
import { AnalyticsPeriod, DraftCategory, DraftFund, DraftGoal, DraftRecurringRule, DraftTag, DraftTransaction, DraftWallet, emptyCategory, emptyFund, emptyGoal, emptyRecurringRule, emptyTag, emptyTransaction, emptyWallet, navItems, View } from "@/components/dashboard/model";
import { AnalyticsView, AutomationView, DashboardView, PlanningView, RecurringView, ReimbursementsView, ReviewView, TaxonomyView, TokensView, TransactionsView, WalletsView } from "@/components/dashboard/views";

function dateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function analyticsRangeFor(period: AnalyticsPeriod): AnalyticsRange {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (period === "last_30_days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    const to = new Date(now);
    to.setDate(to.getDate() + 1);
    return { from: dateOnly(from), to: dateOnly(to) };
  }

  if (period === "previous_month") {
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: dateOnly(previousMonthStart), to: dateOnly(currentMonthStart) };
  }

  return { from: dateOnly(currentMonthStart), to: dateOnly(nextMonthStart) };
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [ready, setReady] = useState<{ status: string; database?: string } | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [balances, setBalances] = useState<Record<string, WalletBalance>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inbox, setInbox] = useState<Transaction[]>([]);
  const [reimbursements, setReimbursements] = useState<Transaction[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [savingGoals, setSavingGoals] = useState<SavingGoal[]>([]);
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [apiKeys, setAPIKeys] = useState<APIKey[]>([]);
  const [webhookTokens, setWebhookTokens] = useState<WebhookToken[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[]>([]);
  const [spending, setSpending] = useState<SpendingPoint[]>([]);
  const [analyticsBalances, setAnalyticsBalances] = useState<WalletBalance[]>([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("current_month");
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedBulk, setSelectedBulk] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [walletFilter, setWalletFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [starterBusy, setStarterBusy] = useState(false);
  const [aiText, setAIText] = useState("");
  const [aiNotice, setAINotice] = useState("");
  const [lastSecret, setLastSecret] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [showAllocation, setShowAllocation] = useState(false);
  const [allocationTarget, setAllocationTarget] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionDraft, setTransactionDraft] = useState<DraftTransaction>(emptyTransaction);
  const [walletDraft, setWalletDraft] = useState<DraftWallet>(emptyWallet);
  const [categoryDraft, setCategoryDraft] = useState<DraftCategory>(emptyCategory);
  const [tagDraft, setTagDraft] = useState<DraftTag>(emptyTag);
  const [goalDraft, setGoalDraft] = useState<DraftGoal>(emptyGoal);
  const [fundDraft, setFundDraft] = useState<DraftFund>(emptyFund);
  const [recurringDraft, setRecurringDraft] = useState<DraftRecurringRule>(emptyRecurringRule);
  const [apiKeyName, setAPIKeyName] = useState("");
  const [webhookTokenName, setWebhookTokenName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const walletById = useMemo(() => new Map(wallets.map((wallet) => [wallet.id, wallet])), [wallets]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const selectedInbox = inbox.find((transaction) => transaction.id === selectedId) ?? inbox[0];
  const profileName = me?.profile?.full_name || me?.email || "Signed-in user";
  const analyticsRange = useMemo(() => analyticsRangeFor(analyticsPeriod), [analyticsPeriod]);

  const filteredTransactions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesQuery =
        !needle ||
        [transaction.merchant, transaction.note, transaction.raw_input, transaction.input_source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return (
        matchesQuery &&
        (typeFilter === "all" || transaction.type === typeFilter) &&
        (statusFilter === "all" || transaction.status === statusFilter) &&
        (categoryFilter === "all" || transaction.category_id === categoryFilter) &&
        (walletFilter === "all" ||
          transaction.wallet_id === walletFilter ||
          transaction.destination_wallet_id === walletFilter)
      );
    });
  }, [transactions, query, typeFilter, statusFilter, categoryFilter, walletFilter]);

  async function loadAll() {
    setError("");
    try {
      const readyData = await api.ready();
      setReady(readyData);

      let meData: Me;
      try {
        meData = await api.me();
      } catch (err) {
        clearProtectedData();
        setMe(null);
        setAuthChecked(true);
        setAuthError(err instanceof Error ? err.message : "Please sign in to continue");
        return;
      }

      setMe(meData);
      setAuthChecked(true);
      setAuthError("");

      let [walletData, categoryData, tagData, inboxData, transactionData] = await Promise.all([
        api.wallets(),
        api.categories(),
        api.tags(),
        api.inbox(),
        api.transactions(),
      ]);

      if (walletData.length === 0 || categoryData.length === 0) {
        await api.setupStarterWorkspace();
        [walletData, categoryData, tagData, inboxData, transactionData] = await Promise.all([
          api.wallets(),
          api.categories(),
          api.tags(),
          api.inbox(),
          api.transactions(),
        ]);
      }

      setWallets(walletData);
      setCategories(categoryData);
      setTags(tagData);
      setInbox(inboxData);
      setTransactions(transactionData);
      if (!selectedId && inboxData[0]) setSelectedId(inboxData[0].id);

      const balancePairs = await Promise.all(
        walletData.map(async (wallet) => [wallet.id, await api.walletBalance(wallet.id)] as const),
      );
      setBalances(Object.fromEntries(balancePairs));
      await loadSecondary(analyticsRange);
    } catch (err) {
      setAuthChecked(true);
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  async function loadSecondary(range: AnalyticsRange = analyticsRange) {
    try {
      const [
        reimbursementData,
        webhookData,
        deadLetterData,
        goalData,
        fundData,
        recurringData,
        apiKeyData,
        webhookTokenData,
        summaryData,
        cashflowData,
        spendingData,
        analyticsBalanceData,
      ] = await Promise.all([
        api.reimbursements(),
        api.webhookEvents(),
        api.deadLetters(),
        api.savingGoals(),
        api.sinkingFunds(),
        api.recurringRules(),
        api.apiKeys(),
        api.webhookTokens(),
        api.analyticsSummary(range),
        api.analyticsCashflow(range),
        api.analyticsSpendingByCategory(range),
        api.analyticsWalletBalances(),
      ]);
      setReimbursements(reimbursementData);
      setWebhookEvents(webhookData);
      setDeadLetters(deadLetterData);
      setSavingGoals(goalData);
      setSinkingFunds(fundData);
      setRecurringRules(recurringData);
      setAPIKeys(apiKeyData);
      setWebhookTokens(webhookTokenData);
      setAnalyticsSummary(summaryData);
      setCashflow(cashflowData);
      setSpending(spendingData);
      setAnalyticsBalances(analyticsBalanceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load debug data");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!me) return;
    void loadSecondary(analyticsRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsRange.from, analyticsRange.to, me?.id]);

  useEffect(() => {
    if (selectedId && inbox.some((transaction) => transaction.id === selectedId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(inbox[0]?.id ?? "");
  }, [inbox, selectedId]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("role") === "combobox";
      if (typing && event.key !== "Escape") return;

      if (event.key === "-") {
        event.preventDefault();
        setShowHelp(true);
      }
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setShowHelp(false);
        setShowEditor(false);
        setShowAllocation(false);
        setSelectedBulk(new Set());
      }
      if (view !== "review" || inbox.length === 0) return;

      const currentIndex = Math.max(0, inbox.findIndex((transaction) => transaction.id === selectedId));
      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        setSelectedId(inbox[Math.min(inbox.length - 1, currentIndex + 1)]?.id ?? "");
      }
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSelectedId(inbox[Math.max(0, currentIndex - 1)]?.id ?? "");
      }
      if (event.key === "Enter" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        if (selectedInbox) openTransactionEditor(selectedInbox);
      }
      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (selectedInbox) void approveTransaction(selectedInbox);
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (selectedInbox) void rejectTransaction(selectedInbox);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, inbox, selectedId, selectedInbox]);

  function openTransactionEditor(transaction: Transaction) {
    setEditingTransaction(transaction);
    setTransactionDraft(transactionToDraft(transaction));
    setShowEditor(true);
  }

  function openNewTransaction(type: TransactionType = "expense") {
    setEditingTransaction(null);
    setTransactionDraft({
      ...emptyTransaction,
      type,
      wallet_id: wallets[0]?.id ?? "",
      category_id: categories.find((category) => category.type === type)?.id ?? "",
    });
    setShowNewTransaction(true);
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function setupStarterWorkspace() {
    setStarterBusy(true);
    setError("");
    try {
      await api.setupStarterWorkspace();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Starter workspace failed");
    } finally {
      setStarterBusy(false);
    }
  }

  async function extractAITransaction(event: FormEvent) {
    event.preventDefault();
    const text = aiText.trim();
    if (!text) return;
    await runAction(async () => {
      const response = await api.extractTransaction(text);
      setSelectedId(response.transaction.id);
      setAIText("");
      setAINotice(`${response.provider} extracted a ${response.transaction.type} draft into review inbox.`);
    });
  }

  function updateAIText(value: string) {
    setAIText(value);
    if (aiNotice) setAINotice("");
  }

  function clearProtectedData() {
    setWallets([]);
    setBalances({});
    setCategories([]);
    setTags([]);
    setTransactions([]);
    setInbox([]);
    setReimbursements([]);
    setWebhookEvents([]);
    setDeadLetters([]);
    setSavingGoals([]);
    setSinkingFunds([]);
    setRecurringRules([]);
    setAPIKeys([]);
    setWebhookTokens([]);
    setAnalyticsSummary(null);
    setCashflow([]);
    setSpending([]);
    setAnalyticsBalances([]);
    setSelectedId("");
    setSelectedBulk(new Set());
    setLastSecret("");
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api.logout();
      setMe(null);
      setAuthError("");
      clearProtectedData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setBusy(false);
    }
  }

  async function approveTransaction(transaction: Transaction) {
    if (transaction.type === "income") {
      setAllocationTarget(transaction);
      setShowAllocation(true);
      return;
    }
    await runAction(async () => {
      await api.approveTransaction(transaction.id);
    });
  }

  async function confirmIncomeAllocation() {
    if (!allocationTarget) return;
    await runAction(async () => {
      await api.approveTransaction(allocationTarget.id);
    });
    setShowAllocation(false);
    setAllocationTarget(null);
  }

  async function rejectTransaction(transaction: Transaction) {
    await runAction(async () => {
      await api.rejectTransaction(transaction.id);
    });
  }

  async function saveTransaction(event: FormEvent, mode: "edit" | "create") {
    event.preventDefault();
    await runAction(async () => {
      const payload = draftToPayload(transactionDraft);
      if (mode === "edit" && editingTransaction) {
        await api.patchTransaction(editingTransaction.id, payload);
      } else if (payload.type === "transfer") {
        await api.createTransfer(payload);
      } else {
        await api.createTransaction(payload);
      }
    });
    setShowEditor(false);
    setShowNewTransaction(false);
  }

  async function saveWallet(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const payload = {
        name: walletDraft.name,
        category: walletDraft.category,
        provider: walletDraft.provider || undefined,
        account_number: walletDraft.account_number || undefined,
        account_holder: walletDraft.account_holder || undefined,
        currency: walletDraft.currency,
        init_balance: Number(walletDraft.init_balance || 0),
        is_active: walletDraft.is_active,
      };
      if (walletDraft.id) await api.patchWallet(walletDraft.id, payload);
      else await api.createWallet(payload);
    });
    setWalletDraft(emptyWallet);
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const payload = {
        name: categoryDraft.name,
        type: categoryDraft.type,
        parent_id: categoryDraft.parent_id || null,
      };
      if (categoryDraft.id) await api.patchCategory(categoryDraft.id, payload);
      else await api.createCategory(payload);
    });
    setCategoryDraft(emptyCategory);
  }

  async function saveTag(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const payload = { name: tagDraft.name, color: tagDraft.color || null };
      if (tagDraft.id) await api.patchTag(tagDraft.id, payload);
      else await api.createTag(payload);
    });
    setTagDraft(emptyTag);
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const payload = {
        wallet_id: goalDraft.wallet_id || undefined,
        name: goalDraft.name,
        target_amount: Number(goalDraft.target_amount || 0),
        current_amount: Number(goalDraft.current_amount || 0),
        currency: goalDraft.currency,
        target_date: goalDraft.target_date || undefined,
        status: goalDraft.status,
        note: goalDraft.note || undefined,
      };
      if (goalDraft.id) await api.patchSavingGoal(goalDraft.id, payload);
      else await api.createSavingGoal(payload);
    });
    setGoalDraft(emptyGoal);
  }

  async function saveFund(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const payload = {
        saving_goal_id: fundDraft.saving_goal_id || undefined,
        wallet_id: fundDraft.wallet_id || undefined,
        name: fundDraft.name,
        target_amount: Number(fundDraft.target_amount || 0),
        current_amount: Number(fundDraft.current_amount || 0),
        monthly_target: Number(fundDraft.monthly_target || 0),
        currency: fundDraft.currency,
        target_date: fundDraft.target_date || undefined,
        status: fundDraft.status,
      };
      if (fundDraft.id) await api.patchSinkingFund(fundDraft.id, payload);
      else await api.createSinkingFund(payload);
    });
    setFundDraft(emptyFund);
  }

  async function saveRecurringRule(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const payload = {
        wallet_id: recurringDraft.wallet_id,
        destination_wallet_id: recurringDraft.destination_wallet_id || undefined,
        category_id: recurringDraft.category_id || undefined,
        name: recurringDraft.name,
        type: recurringDraft.type,
        merchant: recurringDraft.merchant || undefined,
        amount: Number(recurringDraft.amount || 0),
        currency: recurringDraft.currency,
        interval: recurringDraft.interval,
        day_of_month: Number(recurringDraft.day_of_month || 1),
        weekday: Number(recurringDraft.weekday || 1),
        time: recurringDraft.time,
        status: recurringDraft.status,
        note: recurringDraft.note || undefined,
      };
      if (recurringDraft.id) await api.patchRecurringRule(recurringDraft.id, payload);
      else await api.createRecurringRule(payload);
    });
    setRecurringDraft(emptyRecurringRule);
  }

  async function createAPIKey(event: FormEvent) {
    event.preventDefault();
    const name = apiKeyName.trim();
    if (!name) return;
    await runAction(async () => {
      const key = await api.createAPIKey({ name, scopes: ["transactions:read", "transactions:write"] });
      setLastSecret(key.token ?? "");
      setAPIKeyName("");
    });
  }

  async function createWebhookToken(event: FormEvent) {
    event.preventDefault();
    const name = webhookTokenName.trim();
    if (!name) return;
    await runAction(async () => {
      const token = await api.createWebhookToken({ name, source: "ios" });
      setLastSecret(token.token ?? "");
      setWebhookTokenName("");
    });
  }

  async function applyBulkUpdate(status: TransactionStatus) {
    const ids = Array.from(selectedBulk);
    if (ids.length === 0) return;
    await runAction(async () => {
      await api.bulkUpdateTransactions({ ids, status });
    });
    setSelectedBulk(new Set());
  }

  function toggleBulk(id: string) {
    setSelectedBulk((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Tooltip.Provider delayDuration={250}>
      <main className="min-h-screen bg-[#07090d] text-zinc-100">
        {!me ? (
          <LoginScreen
            ready={ready}
            authChecked={authChecked}
            authError={authError}
            onRetry={() => void loadAll()}
          />
        ) : null}
        {me ? (
        <div className="grid min-h-screen lg:grid-cols-[252px_1fr]">
          <aside className="border-b border-zinc-800 bg-[#090b11] lg:border-b-0 lg:border-r">
            <div className="px-5 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Zero-Friction ERP</p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight">Review command center</h1>
              <div className="mt-4 flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs">
                <span className="text-zinc-400">Backend</span>
                <span className={ready?.database === "ok" ? "text-lime-300" : "text-amber-300"}>
                  {ready?.database ?? "checking"}
                </span>
              </div>
            </div>
            <nav className="grid gap-1 px-3 pb-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cx(
                    "group rounded px-3 py-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                    view === item.id
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
                  )}
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span
                    className={cx(
                      "mt-1 block text-xs",
                      view === item.id ? "text-zinc-600" : "text-zinc-500 group-hover:text-zinc-400",
                    )}
                  >
                    {item.detail}
                  </span>
                </button>
              ))}
            </nav>
            <div className="border-t border-zinc-800 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Profile</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded border border-cyan-300/35 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                  {profileName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{profileName}</p>
                  <p className="truncate text-xs text-zinc-500">{me.email}</p>
                </div>
              </div>
              <button className="btn-secondary mt-3 w-full" onClick={logout} disabled={busy}>
                Logout
              </button>
            </div>
          </aside>

          <section className="flex min-w-0 flex-col">
            <header className="flex flex-col gap-3 border-b border-zinc-800 bg-[#090b11]/95 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {navItems.find((item) => item.id === view)?.detail}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{navItems.find((item) => item.id === view)?.label}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search /"
                  className="h-9 w-56 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none placeholder:text-zinc-600 focus:border-cyan-300"
                />
                <button className="btn-secondary" onClick={() => setShowHelp(true)}>
                  Shortcuts -
                </button>
                <button className="btn-primary" onClick={() => openNewTransaction("expense")}>
                  New transaction
                </button>
              </div>
            </header>

            {error ? (
              <div className="border-b border-red-950 bg-red-950/30 px-5 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {wallets.length === 0 || categories.length === 0 ? (
              <div className="border-b border-cyan-950 bg-cyan-950/25 px-5 py-4">
                <div className="flex flex-col gap-3 rounded border border-cyan-300/30 bg-cyan-300/10 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="eyebrow text-cyan-200">Setup starter workspace</p>
                    <p className="mt-2 text-sm text-cyan-50">Cash, Main Bank, E-Wallet, starter categories, and starter tags are required before capture.</p>
                  </div>
                  <button className="btn-primary" disabled={starterBusy} onClick={() => void setupStarterWorkspace()}>
                    {starterBusy ? "Setting up..." : "Setup starter workspace"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {view === "dashboard" ? (
                <DashboardView
                  summary={analyticsSummary}
                  cashflow={cashflow}
                  spending={spending}
                  walletBalances={analyticsBalances}
                  inbox={inbox}
                  selected={selectedInbox}
                  walletById={walletById}
                  categoryById={categoryById}
                  ready={ready}
                  deadLetterCount={deadLetters.filter((letter) => letter.status === "open").length}
                  period={analyticsPeriod}
                  busy={busy}
                  onPeriodChange={setAnalyticsPeriod}
                  onReview={() => setView("review")}
                  onAnalytics={() => setView("analytics")}
                  onSelect={setSelectedId}
                  onApprove={approveTransaction}
                  onReject={rejectTransaction}
                  onEdit={openTransactionEditor}
                />
              ) : null}
              {view === "review" ? (
                <ReviewView
                  inbox={inbox}
                  selected={selectedInbox}
                  walletById={walletById}
                  categoryById={categoryById}
                  busy={busy}
                  aiText={aiText}
                  aiNotice={aiNotice}
                  onSelect={setSelectedId}
                  onAIText={updateAIText}
                  onExtract={extractAITransaction}
                  onApprove={approveTransaction}
                  onReject={rejectTransaction}
                  onEdit={openTransactionEditor}
                />
              ) : null}
              {view === "transactions" ? (
                <TransactionsView
                  transactions={filteredTransactions}
                  wallets={wallets}
                  categories={categories}
                  walletById={walletById}
                  categoryById={categoryById}
                  query={query}
                  typeFilter={typeFilter}
                  statusFilter={statusFilter}
                  categoryFilter={categoryFilter}
                  walletFilter={walletFilter}
                  selectedBulk={selectedBulk}
                  onTypeFilter={setTypeFilter}
                  onStatusFilter={setStatusFilter}
                  onCategoryFilter={setCategoryFilter}
                  onWalletFilter={setWalletFilter}
                  onQueryChange={setQuery}
                  onToggleBulk={toggleBulk}
                  onClearBulk={() => setSelectedBulk(new Set())}
                  onEdit={openTransactionEditor}
                  onDelete={(id) => runAction(async () => { await api.deleteTransaction(id); })}
                  onBulk={applyBulkUpdate}
                  onNewTransfer={() => openNewTransaction("transfer")}
                />
              ) : null}
              {view === "wallets" ? (
                <WalletsView
                  wallets={wallets}
                  balances={balances}
                  draft={walletDraft}
                  setDraft={setWalletDraft}
                  onSubmit={saveWallet}
                  onEdit={(wallet) =>
                    setWalletDraft({
                      id: wallet.id,
                      name: wallet.name,
                      category: wallet.category,
                      provider: wallet.provider ?? "",
                      account_number: wallet.account_number ?? "",
                      account_holder: wallet.account_holder ?? "",
                      currency: wallet.currency,
                      init_balance: String(wallet.init_balance ?? 0),
                      is_active: wallet.is_active,
                    })
                  }
                  onDelete={(id) => runAction(async () => { await api.deleteWallet(id); })}
                />
              ) : null}
              {view === "taxonomy" ? (
                <TaxonomyView
                  categories={categories}
                  tags={tags}
                  categoryDraft={categoryDraft}
                  tagDraft={tagDraft}
                  setCategoryDraft={setCategoryDraft}
                  setTagDraft={setTagDraft}
                  onCategorySubmit={saveCategory}
                  onTagSubmit={saveTag}
                  onDeleteCategory={(id) => runAction(async () => { await api.deleteCategory(id); })}
                  onDeleteTag={(id) => runAction(async () => { await api.deleteTag(id); })}
                />
              ) : null}
              {view === "reimbursements" ? (
                <ReimbursementsView
                  reimbursements={reimbursements}
                  walletById={walletById}
                  categoryById={categoryById}
                  onMark={(id) => runAction(async () => { await api.markReimbursement(id); })}
                  onSettle={(id) => runAction(async () => { await api.settleReimbursement(id); })}
                />
              ) : null}
              {view === "automation" ? (
                <AutomationView
                  events={webhookEvents}
                  deadLetters={deadLetters}
                  onRetryEvent={(id) => runAction(async () => { await api.retryWebhookEvent(id); })}
                  onRetryDeadLetter={(id) => runAction(async () => { await api.retryDeadLetter(id); })}
                  onResolveDeadLetter={(id) => runAction(async () => { await api.resolveDeadLetter(id); })}
                  onIgnoreDeadLetter={(id) => runAction(async () => { await api.ignoreDeadLetter(id); })}
                />
              ) : null}
              {view === "planning" ? (
                <PlanningView
                  goals={savingGoals}
                  funds={sinkingFunds}
                  wallets={wallets}
                  goalDraft={goalDraft}
                  fundDraft={fundDraft}
                  setGoalDraft={setGoalDraft}
                  setFundDraft={setFundDraft}
                  onGoalSubmit={saveGoal}
                  onFundSubmit={saveFund}
                  onEditGoal={(goal) =>
                    setGoalDraft({
                      id: goal.id,
                      wallet_id: goal.wallet_id ?? "",
                      name: goal.name,
                      target_amount: String(goal.target_amount ?? ""),
                      current_amount: String(goal.current_amount ?? 0),
                      currency: goal.currency,
                      target_date: goal.target_date?.slice(0, 10) ?? "",
                      status: goal.status,
                      note: goal.note ?? "",
                    })
                  }
                  onEditFund={(fund) =>
                    setFundDraft({
                      id: fund.id,
                      saving_goal_id: fund.saving_goal_id ?? "",
                      wallet_id: fund.wallet_id ?? "",
                      name: fund.name,
                      target_amount: String(fund.target_amount ?? ""),
                      current_amount: String(fund.current_amount ?? 0),
                      monthly_target: String(fund.monthly_target ?? 0),
                      currency: fund.currency,
                      target_date: fund.target_date?.slice(0, 10) ?? "",
                      status: fund.status,
                    })
                  }
                  onDeleteGoal={(id) => runAction(async () => { await api.deleteSavingGoal(id); })}
                  onDeleteFund={(id) => runAction(async () => { await api.deleteSinkingFund(id); })}
                />
              ) : null}
              {view === "recurring" ? (
                <RecurringView
                  rules={recurringRules}
                  wallets={wallets}
                  categories={categories}
                  draft={recurringDraft}
                  setDraft={setRecurringDraft}
                  onSubmit={saveRecurringRule}
                  onEdit={(rule) =>
                    setRecurringDraft({
                      id: rule.id,
                      wallet_id: rule.wallet_id,
                      destination_wallet_id: rule.destination_wallet_id ?? "",
                      category_id: rule.category_id ?? "",
                      name: rule.name,
                      type: rule.type,
                      merchant: rule.merchant ?? "",
                      amount: String(rule.amount ?? ""),
                      currency: rule.currency,
                      interval: "monthly",
                      day_of_month: "1",
                      weekday: "1",
                      time: "09:00",
                      status: rule.status,
                      note: rule.note ?? "",
                    })
                  }
                  onDelete={(id) => runAction(async () => { await api.deleteRecurringRule(id); })}
                  onRunDue={() => runAction(async () => { await api.runRecurring(); })}
                />
              ) : null}
              {view === "analytics" ? (
                <AnalyticsView
                  summary={analyticsSummary}
                  cashflow={cashflow}
                  spending={spending}
                  walletBalances={analyticsBalances}
                  period={analyticsPeriod}
                  onPeriodChange={setAnalyticsPeriod}
                />
              ) : null}
              {view === "tokens" ? (
                <TokensView
                  apiKeys={apiKeys}
                  webhookTokens={webhookTokens}
                  apiKeyName={apiKeyName}
                  webhookTokenName={webhookTokenName}
                  lastSecret={lastSecret}
                  setAPIKeyName={setAPIKeyName}
                  setWebhookTokenName={setWebhookTokenName}
                  onAPIKeySubmit={createAPIKey}
                  onWebhookTokenSubmit={createWebhookToken}
                  onRevokeAPIKey={(id) => runAction(async () => { await api.revokeAPIKey(id); })}
                  onRevokeWebhookToken={(id) => runAction(async () => { await api.revokeWebhookToken(id); })}
                />
              ) : null}
            </div>
          </section>
        </div>
        ) : null}

        {me ? (
          <>
        <TransactionDialog
          title={editingTransaction ? "Edit transaction" : "New transaction"}
          open={showEditor || showNewTransaction}
          onOpenChange={(open) => {
            if (!open) {
              setShowEditor(false);
              setShowNewTransaction(false);
            }
          }}
          draft={transactionDraft}
          setDraft={setTransactionDraft}
          wallets={wallets}
          categories={categories}
          onSubmit={(event) => saveTransaction(event, editingTransaction ? "edit" : "create")}
          busy={busy}
        />

        <AllocationDialog
          open={showAllocation}
          transaction={allocationTarget}
          onOpenChange={setShowAllocation}
          onConfirm={confirmIncomeAllocation}
          busy={busy}
        />

        <HelpDialog open={showHelp} onOpenChange={setShowHelp} />
          </>
        ) : null}
      </main>
    </Tooltip.Provider>
  );
}

