import type { TransactionStatus, TransactionType } from "@/lib/api";

export type View =
  | "dashboard"
  | "review"
  | "transactions"
  | "wallets"
  | "taxonomy"
  | "reimbursements"
  | "planning"
  | "recurring"
  | "analytics"
  | "automation"
  | "tokens";

export type AnalyticsPeriod = "current_month" | "last_30_days" | "previous_month";

export type DraftTransaction = {
  wallet_id: string;
  destination_wallet_id: string;
  type: TransactionType;
  status: TransactionStatus;
  transaction_at: string;
  merchant: string;
  amount: string;
  category_id: string;
  is_reimbursement: boolean;
  reimbursement_status: string;
  related_transaction_id: string;
  note: string;
  input_source: string;
  input_mode: string;
  raw_input: string;
};

export type DraftWallet = {
  id?: string;
  name: string;
  category: string;
  provider: string;
  account_number: string;
  account_holder: string;
  currency: string;
  init_balance: string;
  is_active: boolean;
};

export type DraftCategory = {
  id?: string;
  name: string;
  type: TransactionType;
  parent_id: string;
};

export type DraftTag = {
  id?: string;
  name: string;
  color: string;
};

export type DraftGoal = {
  id?: string;
  wallet_id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  currency: string;
  target_date: string;
  status: string;
  note: string;
};

export type DraftFund = {
  id?: string;
  saving_goal_id: string;
  wallet_id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  monthly_target: string;
  currency: string;
  target_date: string;
  status: string;
};

export type DraftRecurringRule = {
  id?: string;
  wallet_id: string;
  destination_wallet_id: string;
  category_id: string;
  name: string;
  type: TransactionType;
  merchant: string;
  amount: string;
  currency: string;
  interval: string;
  day_of_month: string;
  weekday: string;
  time: string;
  status: string;
  note: string;
};

export const navItems: { id: View; label: string; detail: string }[] = [
  { id: "dashboard", label: "Dashboard", detail: "Overview" },
  { id: "review", label: "Review", detail: "AI guesses" },
  { id: "transactions", label: "Transactions", detail: "Spreadsheet" },
  { id: "wallets", label: "Wallets", detail: "Balances" },
  { id: "taxonomy", label: "Taxonomy", detail: "Categories & tags" },
  { id: "reimbursements", label: "Reimbursements", detail: "Receivables" },
  { id: "planning", label: "Planning", detail: "Goals & funds" },
  { id: "recurring", label: "Recurring", detail: "Scheduled rules" },
  { id: "analytics", label: "Analytics", detail: "Cashflow" },
  { id: "automation", label: "Automation", detail: "Webhook & DLQ" },
  { id: "tokens", label: "Tokens", detail: "API & webhook" },
];

export const analyticsPeriodLabels: Record<AnalyticsPeriod, string> = {
  current_month: "Current month",
  last_30_days: "Last 30 days",
  previous_month: "Previous month",
};

export const transactionTypes: TransactionType[] = ["expense", "income", "transfer", "adjustment"];
export const statuses: TransactionStatus[] = ["pending", "needs_review", "approved", "rejected"];
export const walletCategories = ["bank", "wallet", "cash", "credit_card", "investment", "other"];
export const roadmapItems = [
  "Budgets",
  "Saving goals",
  "Sinking funds",
  "Income routing rules",
  "Recurring rules",
  "Analytics",
  "API keys",
  "Webhook tokens",
  "AI extraction console",
];

export const emptyTransaction: DraftTransaction = {
  wallet_id: "",
  destination_wallet_id: "",
  type: "expense",
  status: "pending",
  transaction_at: "",
  merchant: "",
  amount: "",
  category_id: "",
  is_reimbursement: false,
  reimbursement_status: "none",
  related_transaction_id: "",
  note: "",
  input_source: "manual",
  input_mode: "text",
  raw_input: "",
};

export const emptyWallet: DraftWallet = {
  name: "",
  category: "bank",
  provider: "",
  account_number: "",
  account_holder: "",
  currency: "IDR",
  init_balance: "",
  is_active: true,
};

export const emptyCategory: DraftCategory = {
  name: "",
  type: "expense",
  parent_id: "",
};

export const emptyTag: DraftTag = {
  name: "",
  color: "#10F5CC",
};

export const emptyGoal: DraftGoal = {
  wallet_id: "",
  name: "",
  target_amount: "",
  current_amount: "",
  currency: "IDR",
  target_date: "",
  status: "active",
  note: "",
};

export const emptyFund: DraftFund = {
  saving_goal_id: "",
  wallet_id: "",
  name: "",
  target_amount: "",
  current_amount: "",
  monthly_target: "",
  currency: "IDR",
  target_date: "",
  status: "active",
};

export const emptyRecurringRule: DraftRecurringRule = {
  wallet_id: "",
  destination_wallet_id: "",
  category_id: "",
  name: "",
  type: "expense",
  merchant: "",
  amount: "",
  currency: "IDR",
  interval: "monthly",
  day_of_month: "1",
  weekday: "1",
  time: "09:00",
  status: "active",
  note: "",
};

