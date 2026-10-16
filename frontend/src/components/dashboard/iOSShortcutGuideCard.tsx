"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Zap,
  CheckCircle2,
  Sparkles,
  Download,
  QrCode,
  Activity,
  X,
} from "lucide-react";
import { api, type APIKey, type WebhookToken, type Transaction } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QRCodeDialog } from "@/components/ui/qr-code-dialog";

interface IOSShortcutGuideCardProps {
  id?: string;
  onKeyCreated?: () => void;
  className?: string;
}

const DEFAULT_SHORTCUT_URL =
  process.env.NEXT_PUBLIC_IOS_SHORTCUT_URL ||
  "https://www.icloud.com/shortcuts/07ca96222ae64bd8b17ed4ff27f4bd59";

/**
 * Multi-strategy clipboard helper for 100% reliable copying on desktop, Safari iOS, and mobile WebViews.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof window === "undefined") return false;

  // Strategy 1: Async Clipboard API (if available and in secure context)
  if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback strategy
    }
  }

  // Strategy 2: Hidden textarea + execCommand('copy') fallback for Safari iOS & WebViews
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "-9999px";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.fontSize = "16px"; // Prevents automatic zoom on iOS Safari

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    return false;
  }
}

export function IOSShortcutGuideCard({
  id = "ios-shortcut",
  onKeyCreated,
  className = "",
}: IOSShortcutGuideCardProps) {
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"url" | "token" | "fullUrl" | null>(null);
  const [lastConnected, setLastConnected] = useState<string | null>(null);
  const [activeIosKeys, setActiveIosKeys] = useState<APIKey[]>([]);
  const [activeIosWebhooks, setActiveIosWebhooks] = useState<WebhookToken[]>([]);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Calculate API endpoint URL
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const apiUrl = origin ? `${origin}/api/backend/ai/extract-transaction` : "https://satset-api.vercel.app/ai/extract-transaction";

  // Full single-line URL with embedded query token
  const fullShortcutUrl = createdToken ? `${apiUrl}?token=${createdToken}` : apiUrl;

  const fetchStatus = useCallback(async () => {
    try {
      const [keys, tokens, recentTxs] = await Promise.allSettled([
        api.apiKeys({ include_revoked: false }),
        api.webhookTokens({ include_revoked: false }),
        api.transactions({ q: "ios", page_size: 5 }),
      ]);

      const validKeys = keys.status === "fulfilled" ? keys.value : [];
      const validTokens = tokens.status === "fulfilled" ? tokens.value : [];
      const txData = recentTxs.status === "fulfilled" ? recentTxs.value?.data || [] : [];

      const iosKeys = validKeys.filter(
        (k) => !k.revoked_at && (k.name.toLowerCase().includes("ios") || k.name.toLowerCase().includes("shortcut"))
      );
      const iosWebhooks = validTokens.filter(
        (t) => !t.revoked_at && (t.source === "ios" || t.name.toLowerCase().includes("ios") || t.name.toLowerCase().includes("shortcut"))
      );

      setActiveIosKeys(iosKeys);
      setActiveIosWebhooks(iosWebhooks);

      // Collect potential timestamps of last connection
      const timestamps: number[] = [];

      iosKeys.forEach((k) => {
        if (k.last_used_at) timestamps.push(new Date(k.last_used_at).getTime());
      });
      iosWebhooks.forEach((t) => {
        if (t.last_used_at) timestamps.push(new Date(t.last_used_at).getTime());
      });
      txData.forEach((tx: Transaction) => {
        if (tx.input_source === "ios" || tx.input_mode?.toLowerCase().includes("ios")) {
          const t = new Date(tx.transaction_at || tx.created_at).getTime();
          if (!isNaN(t)) timestamps.push(t);
        }
      });

      if (timestamps.length > 0) {
        const latestTime = Math.max(...timestamps);
        setLastConnected(new Date(latestTime).toISOString());
      } else {
        setLastConnected(null);
      }
    } catch (err) {
      console.error("Gagal memuat status iOS Shortcut:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (mounted) {
        await fetchStatus();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchStatus]);

  async function handleGenerateFullUrl() {
    setCreatingKey(true);
    try {
      const created = await api.createAPIKey({
        name: "iOS Shortcut",
        scopes: ["transactions:write"],
      });

      if (created.token) {
        setCreatedToken(created.token);
        const generatedUrl = `${apiUrl}?token=${created.token}`;
        const copied = await copyToClipboard(generatedUrl);
        if (copied) {
          setCopiedField("fullUrl");
          toast.success("Tautan Pintasan Siap Pakai Berhasil Disalin!", {
            detail: "Cukup tempelkan tautan ini saat diminta di layar pasang Shortcut iPhone.",
          });
          setTimeout(() => setCopiedField((curr) => (curr === "fullUrl" ? null : curr)), 3500);
        } else {
          toast.success("Tautan berhasil dibuat! Silakan salin tautan di bawah.");
        }
      } else {
        toast.info("API Key berhasil dibuat, namun token tidak dikembalikan.");
      }

      await fetchStatus();
      if (onKeyCreated) {
        onKeyCreated();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuat tautan iOS Shortcut.";
      toast.error("Gagal membuat tautan", { detail: msg });
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleCopyFullUrl() {
    const copied = await copyToClipboard(fullShortcutUrl);
    if (copied) {
      setCopiedField("fullUrl");
      toast.success("Tautan Pintasan Berhasil Disalin!");
      setTimeout(() => setCopiedField((curr) => (curr === "fullUrl" ? null : curr)), 2500);
    } else {
      toast.error("Gagal menyalin tautan.");
    }
  }

  async function handleTestPing() {
    setTestingPing(true);
    try {
      // Test ping using the endpoint with query token or session
      const targetUrl = createdToken ? `${apiUrl}?token=${createdToken}` : apiUrl;
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Ping test dari web dashboard satset ERP" }),
      });

      if (res.ok) {
        toast.success("Uji Koneksi Berhasil!", {
          detail: "Endpoint API siap menerima kiriman struk dari iPhone.",
        });
        setLastConnected(new Date().toISOString());
      } else {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || `Server merespons status ${res.status}`;
        toast.warning("Uji koneksi merespons peringatan", { detail: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tidak dapat menghubungi server.";
      toast.error("Uji koneksi gagal", { detail: msg });
    } finally {
      setTestingPing(false);
    }
  }

  const formatLastConnected = (isoString: string | null) => {
    if (!isoString) return "Belum pernah terhubung";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Belum pernah terhubung";

    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const isOnline = Boolean(lastConnected);
  const totalLiveCredentials = activeIosKeys.length + activeIosWebhooks.length;

  return (
    <div
      id={id}
      className={`w-full max-w-full min-w-0 rounded-2xl border border-[#E8E6E1] bg-[#FFFFFF] shadow-xs overflow-hidden transition-all ${className}`}
    >
      {/* Header Banner */}
      <div className="w-full max-w-full min-w-0 bg-white p-4 sm:p-6 border-b border-[#E8E6E1] overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-[#FAF9F5] text-[#1A1A1A] border border-[#E8E6E1]">
              <Smartphone className="size-5 sm:size-6 text-[#1A1A1A]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1A1A1A]">
                  Integrasi Apple iOS Shortcut
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF9F5] border border-[#E8E6E1] px-2.5 py-0.5 text-[11px] font-semibold text-[#047857]">
                  <Sparkles className="size-3 text-[#047857]" /> Visual Share Sheet
                </span>
              </div>
              <p className="text-xs text-[#756f64] mt-1 leading-relaxed">
                Catat struk fisik &amp; bukti transfer m-banking secepat kilat langsung dari menu Share Sheet iPhone.
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-[#FAF9F5] border border-[#E8E6E1] rounded-xl px-3.5 py-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`size-2.5 rounded-full shrink-0 ${
                  loading
                    ? "bg-[#D8D1C8] animate-pulse"
                    : isOnline
                    ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                    : "bg-amber-500"
                }`}
              />
              <div className="text-left min-w-0">
                <span className="text-[11px] font-bold text-[#1A1A1A] block leading-none">
                  Status Koneksi
                </span>
                <p className="text-[10px] text-[#756f64] truncate mt-0.5">
                  {loading
                    ? "Memeriksa..."
                    : isOnline
                    ? `Terhubung (${formatLastConnected(lastConnected)})`
                    : "Siap Dikonfigurasi"}
                </p>
              </div>
            </div>
            <button
              onClick={() => void fetchStatus()}
              disabled={loading}
              title="Perbarui Status"
              aria-label="Perbarui Status"
              className="size-8 flex items-center justify-center p-1.5 text-[#756f64] hover:text-[#1A1A1A] hover:bg-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] shrink-0"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 space-y-6 w-full max-w-full min-w-0 overflow-hidden">
        {/* Token Alert / Generated URL Banner */}
        {createdToken ? (
          <div className="w-full max-w-full min-w-0 overflow-hidden break-all rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between gap-2.5 min-w-0">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <CheckCircle2 className="size-5 text-[#047857] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-bold text-[#1A1A1A]">
                      Tautan Pintasan Siap Pakai Berhasil Dibuat!
                    </h4>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E8E6E1] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
                      <Check className="size-3" /> Token Tertanam di URL
                    </span>
                  </div>
                  <p className="text-xs text-[#756f64] mt-1 leading-relaxed break-words">
                    Cukup tempelkan satu tautan ini saat diminta di layar pasang Shortcut iPhone Anda. Tidak perlu lagi mengisi HTTP header secara manual!
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                    <code className="w-full max-w-full min-w-0 break-all font-mono select-all text-xs font-bold text-[#1A1A1A] bg-white px-3 py-2.5 rounded-lg border border-[#E8E6E1] shadow-2xs">
                      {fullShortcutUrl}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCopyFullUrl()}
                      className="min-h-[44px] shrink-0 text-xs font-bold gap-1.5 border-[#E0DDD6] bg-[#F0EEE9] hover:bg-[#E8E6E1] text-[#1A1A1A] active:scale-98"
                    >
                      {copiedField === "fullUrl" ? (
                        <>
                          <Check className="size-4 text-[#047857]" /> Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" /> Salin Tautan
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedToken(null)}
                aria-label="Tutup notifikasi token"
                className="size-8 flex items-center justify-center text-[#756f64] hover:text-[#1A1A1A] text-sm -mr-1 -mt-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* 3 Step Streamlined Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
          {/* Langkah 1: Siapkan Tautan 1-Klik */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A1A1A]">
                  <KeyRound className="size-4 text-[#756f64]" />
                  Langkah 1: Tautan 1-Klik
                </span>
                {totalLiveCredentials > 0 && (
                  <Badge variant="success" className="text-[10px]">
                    {totalLiveCredentials} Aktif
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-[#756f64] leading-relaxed">
                Buat tautan tunggal yang menyatukan URL endpoint dan Token otentikasi otomatis.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8E6E1] flex flex-col gap-2">
              <Button
                onClick={() => void handleGenerateFullUrl()}
                disabled={creatingKey}
                className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white text-xs font-bold py-2 gap-2 min-h-[44px] shadow-xs active:scale-98"
              >
                {creatingKey ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Menyiapkan Tautan...
                  </>
                ) : (
                  <>
                    <Zap className="size-4" /> Buat &amp; Salin Tautan
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Langkah 2: Pasang di iOS & QR Code */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A1A1A]">
                <Download className="size-4 text-[#756f64]" />
                Langkah 2: Pasang di iPhone
              </span>
              <p className="mt-2 text-xs text-[#756f64] leading-relaxed">
                Buka tautan resmi Apple di iPhone Anda, lalu tempelkan URL dari Langkah 1 saat diminta.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8E6E1] flex flex-col sm:flex-row gap-2">
              <a
                href={DEFAULT_SHORTCUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white px-3 py-2 text-xs font-bold transition-colors shadow-xs min-h-[44px] active:scale-98 text-center"
              >
                <Download className="size-3.5" />
                Pasang (iCloud)
                <ExternalLink className="size-3 opacity-80" />
              </a>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsQrOpen(true)}
                title="Pindai QR Code di iPhone"
                className="min-h-[44px] px-3 text-xs font-bold gap-1.5 border-[#E0DDD6] bg-white hover:bg-[#F0EEE9] text-[#1A1A1A] shrink-0"
              >
                <QrCode className="size-4 text-[#0071E3]" />
                <span className="hidden sm:inline">Scan QR</span>
              </Button>
            </div>
          </div>

          {/* Langkah 3: Uji Koneksi */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A1A1A]">
                <Activity className="size-4 text-[#756f64]" />
                Langkah 3: Uji Koneksi
              </span>
              <p className="mt-2 text-xs text-[#756f64] leading-relaxed">
                Kirim tes ping untuk memastikan endpoint siap menerima struk dari ponsel Anda.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8E6E1] flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTestPing()}
                disabled={testingPing}
                className="w-full min-h-[44px] text-xs font-bold gap-2 border-[#E0DDD6] bg-white hover:bg-[#F0EEE9] text-[#1A1A1A] active:scale-98"
              >
                {testingPing ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin text-[#047857]" /> Menguji Koneksi...
                  </>
                ) : (
                  <>
                    <Activity className="size-3.5 text-[#047857]" /> Uji Koneksi (Test Ping)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Collapsible: Advanced Developer Info */}
        <div className="pt-2 min-w-0">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="text-[#756f64] text-[11px]">Metode cepat: Token tertanam di URL (?token=zfe_api_...)</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowManualGuide((v) => !v)}
              className="text-xs text-[#756f64] hover:text-[#1A1A1A] gap-1 min-h-[44px]"
            >
              {showManualGuide ? "Tutup Detail Teknis" : "Opsi Lanjutan & Header Manual"}
            </Button>
          </div>

          {showManualGuide && (
            <div className="mt-3 rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 text-xs space-y-3 animate-in fade-in duration-200 min-w-0 overflow-hidden">
              <div>
                <label className="text-[11px] font-semibold text-[#756f64] flex items-center justify-between">
                  <span>Base Endpoint URL (Tanpa Token)</span>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(apiUrl)}
                    className="text-[#0071E3] hover:underline cursor-pointer"
                  >
                    Salin Base URL
                  </button>
                </label>
                <div className="mt-1 font-mono text-[11px] bg-white p-2.5 rounded-lg border border-[#E8E6E1] break-all select-all">
                  {apiUrl}
                </div>
              </div>

              {createdToken && (
                <div>
                  <label className="text-[11px] font-semibold text-[#756f64] flex items-center justify-between">
                    <span>Secret API Key Token</span>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(createdToken)}
                      className="text-[#0071E3] hover:underline cursor-pointer"
                    >
                      Salin Token Saja
                    </button>
                  </label>
                  <div className="mt-1 font-mono text-[11px] bg-white p-2.5 rounded-lg border border-[#E8E6E1] break-all select-all">
                    {createdToken}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[#706A63] leading-relaxed">
                Tindakan Shortcuts mengirim HTTP POST dengan Body JSON: <code className="bg-white px-1 py-0.5 rounded border border-[#E8E6E1]">image_base64</code> (string) dan <code className="bg-white px-1 py-0.5 rounded border border-[#E8E6E1]">image_mime</code> (image/jpeg).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal Dialog */}
      <QRCodeDialog
        open={isQrOpen}
        onOpenChange={setIsQrOpen}
        value={fullShortcutUrl}
        title="Pindai Tautan Shortcut di iPhone"
        description="Arahkan kamera bawaan iPhone ke kode QR untuk menyalin tautan konfigurasi otomatis."
      />
    </div>
  );
}
