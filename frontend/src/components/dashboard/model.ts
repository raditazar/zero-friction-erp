import type { TransactionStatus, TransactionType } from "@/lib/api";

export type View =
  | "review"
  | "transactions"
  | "wallets"
  | "taxonomy"
  | "reimbursements"
  | "automation"
  | "roadmap";

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

export const navItems: { id: View; label: string; detail: string }[] = [
  { id: "review", label: "Review", detail: "AI guesses" },
  { id: "transactions", label: "Transactions", detail: "Spreadsheet" },
  { id: "wallets", label: "Wallets", detail: "Balances" },
  { id: "taxonomy", label: "Taxonomy", detail: "Categories & tags" },
  { id: "reimbursements", label: "Reimbursements", detail: "Receivables" },
  { id: "automation", label: "Automation", detail: "Webhook & DLQ" },
  { id: "roadmap", label: "Roadmap", detail: "Coming soon" },
];

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
  init_balance: "0",
  is_active: true,
};

export const emptyCategory: DraftCategory = {
  name: "",
  type: "expense",
  parent_id: "",
};

export const emptyTag: DraftTag = {
  name: "",
  color: "#22d3ee",
};

