import type { Category, SpendingPoint, Transaction, Wallet } from "./api";

export function escapeCSVField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTransactionsToCSV(
  transactions: Transaction[],
  walletById: Map<string, Wallet>,
  categoryById: Map<string, Category>
): string {
  const headers = ["Tanggal", "Merchant", "Nominal", "Tipe", "Dompet", "Kategori", "Status", "Catatan"];

  const rows = transactions.map((tx) => {
    const dateStr = tx.transaction_at ? tx.transaction_at.split("T")[0] : "";
    const merchantStr = tx.merchant || "";
    const amountStr = typeof tx.amount === "number" ? tx.amount : parseFloat(String(tx.amount)) || 0;
    const typeStr = tx.type || "expense";
    const walletStr = walletById.get(tx.wallet_id)?.name || tx.wallet_id || "";
    const categoryStr = categoryById.get(tx.category_id || "")?.name || "";
    const statusStr = tx.status || "approved";
    const noteStr = tx.note || "";

    return [
      escapeCSVField(dateStr),
      escapeCSVField(merchantStr),
      escapeCSVField(amountStr),
      escapeCSVField(typeStr),
      escapeCSVField(walletStr),
      escapeCSVField(categoryStr),
      escapeCSVField(statusStr),
      escapeCSVField(noteStr),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function generateCSVTemplate(): string {
  const headers = ["Tanggal", "Merchant", "Nominal", "Tipe", "Dompet", "Kategori", "Status", "Catatan"];
  const sampleRows = [
    ["2026-08-12", "Supermarket ABC", "150000", "expense", "Dompet Utama", "Makanan", "approved", "Belanja bulanan"],
    ["2026-08-12", "Gaji Bulanan", "5000000", "income", "Dompet Utama", "Gaji", "approved", "Transfer dari kantor"],
  ];
  return [headers.join(","), ...sampleRows.map((r) => r.map(escapeCSVField).join(","))].join("\n");
}

export function parseCSVLines(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentToken = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentToken += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentToken.trim());
      currentToken = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentToken.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentToken = "";
    } else {
      currentToken += char;
    }
  }

  if (currentToken || currentRow.length > 0) {
    currentRow.push(currentToken.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

export type ParsedTransactionRow = {
  rowIndex: number;
  raw: Record<string, string>;
  tanggal: string;
  merchant: string | null;
  nominal: number;
  tipe: "expense" | "income" | "transfer" | "adjustment";
  dompetName: string;
  wallet_id: string;
  kategoriName: string;
  category_id: string | null;
  status: "approved" | "pending" | "needs_review" | "rejected";
  catatan: string | null;
  isValid: boolean;
  errors: string[];
};

export function parseTransactionsCSV(
  text: string,
  wallets: Wallet[],
  categories: Category[]
): ParsedTransactionRow[] {
  const lines = parseCSVLines(text);
  if (lines.length === 0) return [];

  // Identify headers
  const firstRow = lines[0].map((h) => h.toLowerCase().trim());
  const headerMap: Record<string, number> = {};

  firstRow.forEach((col, idx) => {
    if (col.includes("tanggal") || col.includes("date")) headerMap["tanggal"] = idx;
    else if (col.includes("merchant") || col.includes("deskripsi") || col.includes("description")) headerMap["merchant"] = idx;
    else if (col.includes("nominal") || col.includes("amount") || col.includes("jumlah")) headerMap["nominal"] = idx;
    else if (col.includes("tipe") || col.includes("type")) headerMap["tipe"] = idx;
    else if (col.includes("dompet") || col.includes("wallet")) headerMap["dompet"] = idx;
    else if (col.includes("kategori") || col.includes("category")) headerMap["kategori"] = idx;
    else if (col.includes("status")) headerMap["status"] = idx;
    else if (col.includes("catatan") || col.includes("note") || col.includes("keterangan")) headerMap["catatan"] = idx;
  });

  const hasHeaderRow = Object.keys(headerMap).length > 0;
  const dataRows = hasHeaderRow ? lines.slice(1) : lines;

  // Wallet and Category maps for lookup (case insensitive)
  const walletMap = new Map<string, Wallet>();
  wallets.forEach((w) => {
    walletMap.set(w.name.toLowerCase().trim(), w);
    walletMap.set(w.id.toLowerCase().trim(), w);
  });

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => {
    categoryMap.set(c.name.toLowerCase().trim(), c);
    categoryMap.set(c.id.toLowerCase().trim(), c);
  });

  const getColVal = (row: string[], colName: string, fallbackIdx: number): string => {
    if (hasHeaderRow && headerMap[colName] !== undefined) {
      return row[headerMap[colName]] || "";
    }
    return row[fallbackIdx] || "";
  };

  return dataRows.map((row, index) => {
    const errors: string[] = [];

    const rawTanggal = getColVal(row, "tanggal", 0);
    const rawMerchant = getColVal(row, "merchant", 1);
    const rawNominal = getColVal(row, "nominal", 2);
    const rawTipe = getColVal(row, "tipe", 3);
    const rawDompet = getColVal(row, "dompet", 4);
    const rawKategori = getColVal(row, "kategori", 5);
    const rawStatus = getColVal(row, "status", 6);
    const rawCatatan = getColVal(row, "catatan", 7);

    // Validate Tanggal
    let formattedTanggal = "";
    if (!rawTanggal) {
      formattedTanggal = new Date().toISOString();
    } else {
      const parsedDate = new Date(rawTanggal);
      if (isNaN(parsedDate.getTime())) {
        errors.push(`Tanggal tidak valid: "${rawTanggal}"`);
        formattedTanggal = new Date().toISOString();
      } else {
        formattedTanggal = parsedDate.toISOString();
      }
    }

    // Validate Nominal
    let parsedNominal = 0;
    if (!rawNominal) {
      errors.push("Nominal wajib diisi");
    } else {
      // Handle Indonesian currency formats like "150.000" or "Rp 150.000,00"
      const cleaned = rawNominal
        .replace(/rp/gi, "")
        .replace(/\s+/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      parsedNominal = parseFloat(cleaned);
      if (isNaN(parsedNominal) || parsedNominal <= 0) {
        errors.push(`Nominal tidak valid: "${rawNominal}"`);
        parsedNominal = 0;
      }
    }

    // Validate Tipe
    let tipe: "expense" | "income" | "transfer" | "adjustment" = "expense";
    const tipeLower = rawTipe.toLowerCase().trim();
    if (tipeLower.includes("income") || tipeLower.includes("pemasukan") || tipeLower === "masuk") {
      tipe = "income";
    } else if (tipeLower.includes("transfer")) {
      tipe = "transfer";
    } else if (tipeLower.includes("adjustment") || tipeLower.includes("penyesuaian")) {
      tipe = "adjustment";
    } else {
      tipe = "expense";
    }

    // Validate Wallet
    let wallet_id = "";
    const matchedWallet = rawDompet ? walletMap.get(rawDompet.toLowerCase().trim()) : null;
    if (matchedWallet) {
      wallet_id = matchedWallet.id;
    } else if (wallets.length > 0) {
      wallet_id = wallets[0].id;
      if (rawDompet) {
        // Use default wallet but note as fallback
      } else {
        errors.push("Dompet wajib diisi");
      }
    } else {
      errors.push("Tidak ada dompet yang tersedia di akun Anda");
    }

    // Validate Category
    let category_id: string | null = null;
    if (rawKategori) {
      const matchedCategory = categoryMap.get(rawKategori.toLowerCase().trim());
      if (matchedCategory) {
        category_id = matchedCategory.id;
      }
    }

    // Validate Status
    let status: "approved" | "pending" | "needs_review" | "rejected" = "approved";
    const statusLower = rawStatus.toLowerCase().trim();
    if (statusLower.includes("pending")) {
      status = "pending";
    } else if (statusLower.includes("needs_review") || statusLower.includes("tinjau") || statusLower.includes("review")) {
      status = "needs_review";
    } else if (statusLower.includes("rejected") || statusLower.includes("tolak")) {
      status = "rejected";
    } else {
      status = "approved";
    }

    const merchant = rawMerchant.trim() || null;
    const catatan = rawCatatan.trim() || null;

    return {
      rowIndex: index + 1,
      raw: {
        tanggal: rawTanggal,
        merchant: rawMerchant,
        nominal: rawNominal,
        tipe: rawTipe,
        dompet: rawDompet,
        kategori: rawKategori,
        status: rawStatus,
        catatan: rawCatatan,
      },
      tanggal: formattedTanggal,
      merchant,
      nominal: parsedNominal,
      tipe,
      dompetName: matchedWallet ? matchedWallet.name : rawDompet || (wallets[0]?.name ?? "Default"),
      wallet_id,
      kategoriName: category_id ? (categories.find((c) => c.id === category_id)?.name ?? rawKategori) : rawKategori || "-",
      category_id,
      status,
      catatan,
      isValid: errors.length === 0,
      errors,
    };
  });
}

export function exportAnalyticsSummaryToCSV(
  summary: { income: number | string; expense: number | string; net_cashflow: number | string } | null,
  spendingCategories: SpendingPoint[],
  spendingTags: SpendingPoint[],
  dateRange: { from: string; to: string }
): string {
  const lines: string[] = [];

  lines.push(`"Laporan Analisis Keuangan ERP"`);
  lines.push(`"Periode","${dateRange.from} s/d ${dateRange.to}"`);
  lines.push(`"Tanggal Ekspor","${new Date().toLocaleString()}"`);
  lines.push("");

  lines.push(`"RINGKASAN CASHFLOW"`);
  lines.push(`"Total Pemasukan","Total Pengeluaran","Arus Kas Bersih"`);
  const inc = summary ? (typeof summary.income === "number" ? summary.income : parseFloat(String(summary.income || 0))) : 0;
  const exp = summary ? (typeof summary.expense === "number" ? summary.expense : parseFloat(String(summary.expense || 0))) : 0;
  const net = summary ? (typeof summary.net_cashflow === "number" ? summary.net_cashflow : parseFloat(String(summary.net_cashflow || 0))) : 0;
  lines.push(`${escapeCSVField(inc)},${escapeCSVField(exp)},${escapeCSVField(net)}`);
  lines.push("");

  const totalCatExpense = spendingCategories.reduce(
    (acc, c) => acc + (typeof c.amount === "number" ? c.amount : parseFloat(String(c.amount || 0))),
    0
  );

  lines.push(`"PENGELUARAN PER KATEGORI"`);
  lines.push(`"Nama Kategori","Total Nominal (Rp)","Persentase (%)"`);
  spendingCategories.forEach((cat) => {
    const name = cat.name || "Lainnya";
    const amt = typeof cat.amount === "number" ? cat.amount : parseFloat(String(cat.amount || 0));
    const pct = totalCatExpense > 0 ? (amt / totalCatExpense) * 100 : 0;
    lines.push(`${escapeCSVField(name)},${escapeCSVField(amt)},${escapeCSVField(pct.toFixed(1))}`);
  });
  lines.push("");

  lines.push(`"PENGELUARAN PER TAG"`);
  lines.push(`"Nama Tag","Total Nominal (Rp)"`);
  spendingTags.forEach((tag) => {
    const name = tag.name || "Tanpa Tag";
    const amt = typeof tag.amount === "number" ? tag.amount : parseFloat(String(tag.amount || 0));
    lines.push(`${escapeCSVField(name)},${escapeCSVField(amt)}`);
  });

  return lines.join("\n");
}
