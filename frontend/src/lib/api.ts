export type Wallet = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  provider: string | null;
  account_number: string | null;
  account_holder: string | null;
  currency: string;
  init_balance: string | number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  avatar: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Me = {
  id: string;
  email: string;
  created_at: string;
  profile: Profile | null;
};

export type WalletBalance = {
  wallet_id: string;
  user_id: string;
  name: string;
  category: string;
  currency: string;
  curr_balance: string | number;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  parent_id: string | null;
  created_at: string;
  updated_at?: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at?: string;
};

export type TransactionType = "income" | "expense" | "transfer" | "adjustment";
export type TransactionStatus = "pending" | "approved" | "rejected" | "needs_review";

export type Transaction = {
  id: string;
  user_id: string;
  wallet_id: string;
  destination_wallet_id: string | null;
  type: TransactionType;
  status: TransactionStatus;
  transaction_at: string;
  merchant: string | null;
  amount: string | number;
  category_id: string | null;
  is_reimbursement: boolean;
  reimbursement_status: string;
  related_transaction_id: string | null;
  note: string | null;
  input_source: string | null;
  input_mode: string | null;
  raw_input: string | null;
  ai_confidence: string | number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type TransactionPage = {
  data: Transaction[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export type TransactionQuery = {
  page?: number;
  page_size?: number;
  sort?: "transaction_at" | "merchant" | "amount" | "status" | "type";
  order?: "asc" | "desc";
  q?: string;
  status?: TransactionStatus | "all";
  type?: TransactionType | "all";
  wallet_id?: string | "all";
  category_id?: string | "all";
  from?: string;
  to?: string;
};

export type WebhookEvent = {
  id: string;
  user_id: string;
  source: string;
  idempotency_text: string;
  payload: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DeadLetter = {
  id: string;
  user_id: string;
  webhook_event_id: string | null;
  raw_payload: unknown;
  error_msg: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type TransactionPayload = Partial<
  Pick<
    Transaction,
    | "wallet_id"
    | "destination_wallet_id"
    | "type"
    | "status"
    | "transaction_at"
    | "merchant"
    | "amount"
    | "category_id"
    | "is_reimbursement"
    | "reimbursement_status"
    | "related_transaction_id"
    | "note"
    | "input_source"
    | "input_mode"
    | "raw_input"
    | "ai_confidence"
  >
>;

export type StarterWorkspaceResult = {
  status: string;
  inserted_wallets: number;
  inserted_categories: number;
  inserted_tags: number;
};

export type AIExtractTransactionResult = {
  provider: string;
  status: "needs_review";
  result: Record<string, unknown>;
  transaction: Transaction;
};

export type SavingGoal = {
  id: string;
  user_id: string;
  wallet_id: string | null;
  name: string;
  target_amount: string | number;
  current_amount: string | number;
  currency: string;
  target_date: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type SinkingFund = {
  id: string;
  user_id: string;
  saving_goal_id: string | null;
  wallet_id: string | null;
  name: string;
  target_amount: string | number;
  current_amount: string | number;
  monthly_target: string | number;
  currency: string;
  target_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RecurringRule = {
  id: string;
  user_id: string;
  wallet_id: string;
  destination_wallet_id: string | null;
  category_id: string | null;
  name: string;
  type: TransactionType;
  merchant: string | null;
  amount: string | number;
  currency: string;
  cron_expression: string;
  status: string;
  next_run_at: string | null;
  last_run_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type APIKey = {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  token?: string;
};

export type WebhookToken = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  source: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  token?: string;
};

export type AnalyticsSummary = {
  period: { from: string; to: string };
  basis: string;
  income: string | number;
  expense: string | number;
  transfer: string | number;
  net_cashflow: string | number;
  inbox: { basis: string; count: number; amount: string | number };
  forecast: { basis: string; income: string | number; expense: string | number };
};

export type AnalyticsRange = {
  from: string;
  to: string;
};

export type CashflowPoint = {
  day: string;
  income: string | number;
  expense: string | number;
  basis: string;
};

export type SpendingPoint = {
  id: string | null;
  name: string | null;
  amount: string | number;
  basis: string;
};

const API_PREFIX = "/api/backend";
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";
export const GOOGLE_LOGIN_URL = `${BACKEND_BASE_URL}/auth/google/login`;

function withRange(path: string, range?: AnalyticsRange) {
  if (!range) return path;
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return `${path}?${params.toString()}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  ready: () => request<{ status: string; database?: string }>("/readyz"),
  me: () => request<Me>("/me"),
  logout: () => request<{ status: string }>("/auth/logout", { method: "POST" }),
  setupStarterWorkspace: () =>
    request<StarterWorkspaceResult>("/starter-workspace", { method: "POST" }),
  wallets: () => request<Wallet[]>("/wallets"),
  walletBalance: (id: string) => request<WalletBalance>(`/wallets/${id}/balance`),
  createWallet: (payload: Partial<Wallet>) =>
    request<Wallet>("/wallets", { method: "POST", body: JSON.stringify(payload) }),
  patchWallet: (id: string, payload: Partial<Wallet>) =>
    request<Wallet>(`/wallets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteWallet: (id: string) => request<{ id: string }>(`/wallets/${id}`, { method: "DELETE" }),

  categories: () => request<Category[]>("/categories"),
  createCategory: (payload: Pick<Category, "name" | "type"> & { parent_id?: string | null }) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(payload) }),
  patchCategory: (id: string, payload: Partial<Category>) =>
    request<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCategory: (id: string) => request<{ id: string }>(`/categories/${id}`, { method: "DELETE" }),

  tags: () => request<Tag[]>("/tags"),
  createTag: (payload: Pick<Tag, "name"> & { color?: string | null }) =>
    request<Tag>("/tags", { method: "POST", body: JSON.stringify(payload) }),
  patchTag: (id: string, payload: Partial<Tag>) =>
    request<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTag: (id: string) => request<{ id: string }>(`/tags/${id}`, { method: "DELETE" }),

  inbox: () => request<Transaction[]>("/inbox/transactions"),
  extractTransaction: (text: string) =>
    request<AIExtractTransactionResult>("/ai/extract-transaction", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  transactions: (query: TransactionQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return request<TransactionPage>(`/transactions${suffix}`);
  },
  createTransaction: (payload: TransactionPayload) =>
    request<Transaction>("/transactions", { method: "POST", body: JSON.stringify(payload) }),
  createTransfer: (payload: TransactionPayload) =>
    request<Transaction>("/transactions/transfer", { method: "POST", body: JSON.stringify(payload) }),
  patchTransaction: (id: string, payload: TransactionPayload) =>
    request<Transaction>(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTransaction: (id: string) =>
    request<{ id: string }>(`/transactions/${id}`, { method: "DELETE" }),
  approveTransaction: (id: string) =>
    request<Transaction>(`/transactions/${id}/approve`, { method: "POST" }),
  rejectTransaction: (id: string) =>
    request<Transaction>(`/transactions/${id}/reject`, { method: "POST" }),
  bulkUpdateTransactions: (payload: { ids: string[]; status?: string; category_id?: string }) =>
    request<Transaction[]>("/transactions/bulk-update", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  reimbursements: () => request<Transaction[]>("/reimbursements"),
  markReimbursement: (id: string) =>
    request<Transaction>(`/transactions/${id}/mark-reimbursement`, { method: "POST" }),
  linkReimbursement: (id: string, related_transaction_id: string) =>
    request<Transaction>(`/transactions/${id}/link-reimbursement`, {
      method: "POST",
      body: JSON.stringify({ related_transaction_id }),
    }),
  settleReimbursement: (id: string) =>
    request<Transaction>(`/transactions/${id}/settle-reimbursement`, { method: "POST" }),

  webhookEvents: () => request<WebhookEvent[]>("/webhook-events"),
  retryWebhookEvent: (id: string) =>
    request<WebhookEvent>(`/webhook-events/${id}/retry`, { method: "POST" }),
  deadLetters: () => request<DeadLetter[]>("/dead-letter-queue"),
  retryDeadLetter: (id: string) =>
    request<DeadLetter>(`/dead-letter-queue/${id}/retry`, { method: "POST" }),
  resolveDeadLetter: (id: string) =>
    request<DeadLetter>(`/dead-letter-queue/${id}/resolve`, { method: "POST" }),
  ignoreDeadLetter: (id: string) =>
    request<DeadLetter>(`/dead-letter-queue/${id}/ignore`, { method: "POST" }),

  savingGoals: () => request<SavingGoal[]>("/saving-goals"),
  createSavingGoal: (payload: Partial<SavingGoal>) =>
    request<SavingGoal>("/saving-goals", { method: "POST", body: JSON.stringify(payload) }),
  patchSavingGoal: (id: string, payload: Partial<SavingGoal>) =>
    request<SavingGoal>(`/saving-goals/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSavingGoal: (id: string) =>
    request<{ id: string }>(`/saving-goals/${id}`, { method: "DELETE" }),

  sinkingFunds: () => request<SinkingFund[]>("/sinking-funds"),
  createSinkingFund: (payload: Partial<SinkingFund>) =>
    request<SinkingFund>("/sinking-funds", { method: "POST", body: JSON.stringify(payload) }),
  patchSinkingFund: (id: string, payload: Partial<SinkingFund>) =>
    request<SinkingFund>(`/sinking-funds/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSinkingFund: (id: string) =>
    request<{ id: string }>(`/sinking-funds/${id}`, { method: "DELETE" }),

  recurringRules: () => request<RecurringRule[]>("/recurring-rules"),
  createRecurringRule: (payload: Record<string, unknown>) =>
    request<RecurringRule>("/recurring-rules", { method: "POST", body: JSON.stringify(payload) }),
  patchRecurringRule: (id: string, payload: Record<string, unknown>) =>
    request<RecurringRule>(`/recurring-rules/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteRecurringRule: (id: string) =>
    request<{ id: string }>(`/recurring-rules/${id}`, { method: "DELETE" }),
  runRecurring: () => request<{ created_transactions: Transaction[]; updated_rules: RecurringRule[] }>("/cron/run-recurring", { method: "POST" }),

  apiKeys: () => request<APIKey[]>("/api-keys"),
  createAPIKey: (payload: { name: string; scopes: string[]; expires_at?: string }) =>
    request<APIKey>("/api-keys", { method: "POST", body: JSON.stringify(payload) }),
  revokeAPIKey: (id: string) => request<APIKey>(`/api-keys/${id}`, { method: "DELETE" }),

  webhookTokens: () => request<WebhookToken[]>("/webhook-tokens"),
  createWebhookToken: (payload: { name: string; source?: string; expires_at?: string }) =>
    request<WebhookToken>("/webhook-tokens", { method: "POST", body: JSON.stringify(payload) }),
  revokeWebhookToken: (id: string) =>
    request<WebhookToken>(`/webhook-tokens/${id}`, { method: "DELETE" }),

  analyticsSummary: (range?: AnalyticsRange) => request<AnalyticsSummary>(withRange("/analytics/summary", range)),
  analyticsCashflow: (range?: AnalyticsRange) => request<CashflowPoint[]>(withRange("/analytics/cashflow", range)),
  analyticsSpendingByCategory: (range?: AnalyticsRange) =>
    request<SpendingPoint[]>(withRange("/analytics/spending-by-category", range)),
  analyticsWalletBalances: () => request<WalletBalance[]>("/analytics/wallet-balances"),
};
