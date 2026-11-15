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
      setTimeout(() => {
        setSelectedFile(null);
        setParsedRows([]);
        setIsParsing(false);
        setIsImporting(false);
        setImportProgress({ current: 0, total: 0 });
        setErrorMessage(null);
        setSuccessMessage(null);
      }, 0);
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
              className="text-xs px-2.5 py-1 min-h-[32px] gap-1 text-ink-soft hover:text-ink"
            >
              <Download className="size-3.5" />
              Unduh Format CSV
            </Button>
          </AppDialogTitle>
          <AppDialogDescription>
            Unggah file CSV dengan kolom: <code className="bg-paper-sunk px-1 py-0.5 rounded text-xs text-ink">Tanggal, Merchant, Nominal, Tipe, Dompet, Kategori, Status, Catatan</code>
          </AppDialogDescription>
        </AppDialogHeader>

        <AppDialogBody className="space-y-4">
          {errorMessage && (
            <div className="bg-negative-soft border border-negative-line text-negative px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-positive-soft border border-positive-line text-positive px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
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
              className="border-2 border-dashed border-line-strong hover:border-ink bg-paper hover:bg-paper-sunk rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-3"
            >
              <div className="p-3 bg-line rounded-full text-ink">
                <Upload className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Klik untuk memilih file CSV atau seret ke sini</p>
                <p className="text-xs text-ink-soft mt-1">Mendukung format .csv (maksimal 500 baris per impor)</p>
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
            <div className="flex items-center justify-between bg-paper-sunk border border-line px-4 py-3 rounded-lg text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-5 text-ink shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{selectedFile.name}</p>
                  <p className="text-xs text-ink-soft">{(selectedFile.size / 1024).toFixed(1)} KB</p>
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
                className="text-xs px-2 py-1 min-h-[32px] gap-1 text-negative hover:bg-negative-soft"
              >
                <Trash2 className="size-3.5" />
                Ganti File
              </Button>
            </div>
          )}

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="py-8 text-center text-sm text-ink-soft flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-ink" />
              <span>Memproses dan memvalidasi file CSV...</span>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {!isParsing && parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="bg-line text-ink px-2.5 py-1 rounded-full font-bold">
                    Total: {parsedRows.length} baris
                  </span>
                  <span className="bg-positive-soft text-positive px-2.5 py-1 rounded-full font-bold">
                    Valid: {validRows.length}
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="bg-negative-soft text-negative px-2.5 py-1 rounded-full font-bold">
                      Error: {invalidRows.length}
                    </span>
                  )}
                </div>
                <span className="text-ink-soft">Menampilkan pratinjau hasil analisa CSV</span>
              </div>

              <div className="max-h-[320px] overflow-auto border border-line rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-paper-sunk text-ink-soft font-bold uppercase tracking-wider border-b border-line">
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
                  <tbody className="divide-y divide-line bg-card">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.isValid ? "hover:bg-paper" : "bg-negative-soft hover:bg-negative-soft"}
                      >
                        <td className="px-3 py-2 font-mono text-ink-soft">{row.rowIndex}</td>
                        <td className="px-3 py-2 font-medium">{row.tanggal.split("T")[0]}</td>
                        <td className="px-3 py-2 font-semibold text-ink">{row.merchant || "-"}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-ink">
                          {amount(row.nominal)}
                        </td>
                        <td className="px-3 py-2 uppercase font-mono text-xs">{row.tipe}</td>
                        <td className="px-3 py-2">{row.dompetName}</td>
                        <td className="px-3 py-2">{row.kategoriName}</td>
                        <td className="px-3 py-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center rounded-md bg-positive-soft px-2 py-0.5 text-xs font-semibold text-positive">
                              Valid
                            </span>
                          ) : (
                            <span
                              title={row.errors.join("; ")}
                              className="inline-flex items-center rounded-md bg-negative-soft px-2 py-0.5 text-xs font-semibold text-negative"
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
            <div className="space-y-2 bg-paper border border-line p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>Mengimpor data ke server...</span>
                <span>
                  {importProgress.current} dari {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 transition-all duration-300 rounded-full"
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
