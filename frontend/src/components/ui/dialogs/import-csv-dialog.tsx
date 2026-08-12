"use client";

import * as React from "react";
import { Upload, Download, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogBody,
  AppDialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, type Category, type TransactionPayload, type Wallet } from "@/lib/api";
import { downloadCSV, generateCSVTemplate, parseTransactionsCSV, type ParsedTransactionRow } from "@/lib/csv-utils";
import { amount } from "@/components/dashboard/formatters";
import { toast } from "@/components/ui/toast";

export interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  categories: Category[];
  onImportComplete: () => void;
}

export function ImportCsvDialog({
  open,
  onOpenChange,
  wallets,
  categories,
  onImportComplete,
}: ImportCsvDialogProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [parsedRows, setParsedRows] = React.useState<ParsedTransactionRow[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      // Reset state on modal close
      setSelectedFile(null);
      setParsedRows([]);
      setIsParsing(false);
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [open]);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      const msg = "File harus berformat CSV (.csv)";
      setErrorMessage(msg);
      toast.error("Format file tidak valid", { detail: msg });
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseTransactionsCSV(text, wallets, categories);
        setParsedRows(rows);
      } catch (err) {
        console.error(err);
        const errMsg = "Gagal membaca file CSV. Pastikan format file sesuai.";
        setErrorMessage(errMsg);
        toast.error("Gagal membaca file CSV", { detail: errMsg });
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      const errMsg = "Gagal membaca file.";
      setErrorMessage(errMsg);
      toast.error("Gagal membaca file", { detail: errMsg });
      setIsParsing(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    downloadCSV("template_impor_transaksi.csv", template);
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const handleStartImport = async () => {
    if (validRows.length === 0) return;

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setImportProgress({ current: 0, total: validRows.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setImportProgress({ current: i + 1, total: validRows.length });

      try {
        const payload: TransactionPayload = {
          amount: row.nominal,
          transaction_at: row.tanggal,
          type: row.tipe,
          wallet_id: row.wallet_id,
          category_id: row.category_id,
          merchant: row.merchant,
          status: row.status,
          note: row.catatan,
        };

        await api.createTransaction(payload);
        successCount++;
      } catch (err) {
        console.error(`Gagal mengimpor baris #${row.rowIndex}:`, err);
        failCount++;
      }
    }

    setIsImporting(false);

    if (failCount === 0) {
      const msg = `Berhasil mengimpor ${successCount} transaksi ke dalam ledger!`;
      setSuccessMessage(msg);
      toast.success(msg);
      onImportComplete();
      setTimeout(() => {
        onOpenChange(false);
      }, 1200);
    } else {
      const errMsg = `Berhasil mengimpor ${successCount} transaksi, namun ${failCount} transaksi gagal diproses.`;
      setErrorMessage(errMsg);
      toast.error("Impor CSV selesai dengan beberapa kendala", { detail: errMsg });
      onImportComplete();
    }
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="xl">
        <AppDialogHeader>
          <AppDialogTitle className="flex items-center justify-between">
            <span>Impor Transaksi CSV</span>
            <Button
              variant="outline"
              type="button"
              onClick={handleDownloadTemplate}
              className="text-xs px-2.5 py-1 min-h-[32px] gap-1 text-[#5A5A5A] hover:text-[#1A1A1A]"
            >
              <Download className="size-3.5" />
              Unduh Format CSV
            </Button>
          </AppDialogTitle>
          <AppDialogDescription>
            Unggah file CSV dengan kolom: <code className="bg-[#E8E6E1] px-1 py-0.5 rounded text-xs text-[#1A1A1A]">Tanggal, Merchant, Nominal, Tipe, Dompet, Kategori, Status, Catatan</code>
          </AppDialogDescription>
        </AppDialogHeader>

        <AppDialogBody className="space-y-4">
          {errorMessage && (
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-[#D1FAE5] border border-[#6EE7B7] text-[#065F46] px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* File Upload Zone */}
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileChange(file);
              }}
              className="border-2 border-dashed border-[#CBD5E1] hover:border-[#1A1A1A] bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3"
            >
              <div className="p-3 bg-[#E2E8F0] rounded-full text-[#334155]">
                <Upload className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1E293B]">Klik untuk memilih file CSV atau seret ke sini</p>
                <p className="text-xs text-[#64748B] mt-1">Mendukung format .csv (maksimal 500 baris per impor)</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between bg-[#F1F5F9] border border-[#E2E8F0] px-4 py-3 rounded-lg text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-5 text-[#334155] shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-[#1E293B] truncate">{selectedFile.name}</p>
                  <p className="text-xs text-[#64748B]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button
                variant="outline"
                type="button"
                disabled={isImporting}
                onClick={() => {
                  setSelectedFile(null);
                  setParsedRows([]);
                }}
                className="text-xs px-2 py-1 min-h-[32px] gap-1 text-[#991B1B] hover:bg-[#FEE2E2]"
              >
                <Trash2 className="size-3.5" />
                Ganti File
              </Button>
            </div>
          )}

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="py-8 text-center text-sm text-[#5A5A5A] flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-[#1A1A1A]" />
              <span>Memproses dan memvalidasi file CSV...</span>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {!isParsing && parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="bg-[#E2E8F0] text-[#334155] px-2.5 py-1 rounded-full font-bold">
                    Total: {parsedRows.length} baris
                  </span>
                  <span className="bg-[#D1FAE5] text-[#065F46] px-2.5 py-1 rounded-full font-bold">
                    Valid: {validRows.length}
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="bg-[#FEE2E2] text-[#991B1B] px-2.5 py-1 rounded-full font-bold">
                      Error: {invalidRows.length}
                    </span>
                  )}
                </div>
                <span className="text-[#64748B]">Menampilkan pratinjau hasil analisa CSV</span>
              </div>

              <div className="max-h-[320px] overflow-auto border border-[#E0DDD6] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#F0EEE9] text-[#5A5A5A] font-bold uppercase tracking-wider border-b border-[#E0DDD6]">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Merchant</th>
                      <th className="px-3 py-2 text-right">Nominal</th>
                      <th className="px-3 py-2">Tipe</th>
                      <th className="px-3 py-2">Dompet</th>
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0DDD6] bg-white">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.isValid ? "hover:bg-[#F9F8F5]" : "bg-[#FEF2F2] hover:bg-[#FEE2E2]"}
                      >
                        <td className="px-3 py-2 font-mono text-[#64748B]">{row.rowIndex}</td>
                        <td className="px-3 py-2 font-medium">{row.tanggal.split("T")[0]}</td>
                        <td className="px-3 py-2 font-semibold text-[#1A1A1A]">{row.merchant || "-"}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[#1A1A1A]">
                          {amount(row.nominal)}
                        </td>
                        <td className="px-3 py-2 uppercase font-mono text-[10px]">{row.tipe}</td>
                        <td className="px-3 py-2">{row.dompetName}</td>
                        <td className="px-3 py-2">{row.kategoriName}</td>
                        <td className="px-3 py-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center rounded-md bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-semibold text-[#065F46]">
                              Valid
                            </span>
                          ) : (
                            <span
                              title={row.errors.join("; ")}
                              className="inline-flex items-center rounded-md bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#991B1B]"
                            >
                              {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Bar during Import */}
          {isImporting && (
            <div className="space-y-2 bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1E293B]">
                <span>Mengimpor data ke server...</span>
                <span>
                  {importProgress.current} dari {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#1A1A1A] h-2 transition-all duration-300 rounded-full"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </AppDialogBody>

        <AppDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Batal
          </Button>

          <Button
            type="button"
            variant="default"
            disabled={isImporting || validRows.length === 0}
            onClick={handleStartImport}
            className="btn-primary min-h-[44px]"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Mengimpor...
              </>
            ) : (
              `Impor ${validRows.length} Transaksi`
            )}
          </Button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
