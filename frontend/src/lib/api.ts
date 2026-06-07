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

const API_PREFIX = "/api/backend";
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";
export const GOOGLE_LOGIN_URL = `${BACKEND_BASE_URL}/auth/google/login`;

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
  transactions: () => request<Transaction[]>("/transactions"),
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
};
