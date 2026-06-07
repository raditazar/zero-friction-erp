import type { Transaction, TransactionPayload } from "@/lib/api";
import type { DraftTransaction } from "./model";

const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function amount(value: string | number | null | undefined) {
  return formatIDR.format(Number(value ?? 0));
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function shortID(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "-";
}

export function transactionToDraft(transaction: Transaction): DraftTransaction {
  return {
    wallet_id: transaction.wallet_id,
    destination_wallet_id: transaction.destination_wallet_id ?? "",
    type: transaction.type,
    status: transaction.status,
    transaction_at: transaction.transaction_at.slice(0, 16),
    merchant: transaction.merchant ?? "",
    amount: String(transaction.amount ?? ""),
    category_id: transaction.category_id ?? "",
    is_reimbursement: transaction.is_reimbursement,
    reimbursement_status: transaction.reimbursement_status ?? "none",
    related_transaction_id: transaction.related_transaction_id ?? "",
    note: transaction.note ?? "",
    input_source: transaction.input_source ?? "manual",
    input_mode: transaction.input_mode ?? "text",
    raw_input: transaction.raw_input ?? "",
  };
}

export function draftToPayload(draft: DraftTransaction): TransactionPayload {
  return {
    wallet_id: draft.wallet_id,
    destination_wallet_id: draft.destination_wallet_id || undefined,
    type: draft.type,
    status: draft.status,
    transaction_at: draft.transaction_at ? new Date(draft.transaction_at).toISOString() : undefined,
    merchant: draft.merchant || undefined,
    amount: Number(draft.amount),
    category_id: draft.category_id || undefined,
    is_reimbursement: draft.is_reimbursement,
    reimbursement_status: draft.is_reimbursement ? draft.reimbursement_status || "receivable" : "none",
    related_transaction_id: draft.related_transaction_id || undefined,
    note: draft.note || undefined,
    input_source: draft.input_source || undefined,
    input_mode: draft.input_mode || undefined,
    raw_input: draft.raw_input || undefined,
  };
}

