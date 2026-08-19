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
  ShieldCheck,
  X,
} from "lucide-react";
import { api, type APIKey, type WebhookToken, type Transaction } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"url" | "token" | null>(null);
  const [lastConnected, setLastConnected] = useState<string | null>(null);
  const [activeIosKeys, setActiveIosKeys] = useState<APIKey[]>([]);
  const [activeIosWebhooks, setActiveIosWebhooks] = useState<WebhookToken[]>([]);
  const [showManualGuide, setShowManualGuide] = useState(false);

  // Calculate API endpoint URL
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const apiUrl = origin ? `${origin}/api/backend/ai/extract-transaction` : "https://satset-api.vercel.app/ai/extract-transaction";

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

  async function handleCreateToken() {
    setCreatingKey(true);
    try {
      const created = await api.createAPIKey({
        name: "iOS Shortcut",
        scopes: ["transactions:write"],
      });

      if (created.token) {
        setCreatedToken(created.token);
        const copied = await copyToClipboard(created.token);
        if (copied) {
          setCopiedField("token");
          toast.success("Token berhasil disalin!", {
            detail: "Tempelkan token ke layar instalasi Shortcut iPhone Anda.",
          });
          setTimeout(() => setCopiedField((curr) => (curr === "token" ? null : curr)), 3500);
        } else {
          toast.success("Token iOS Shortcut berhasil dibuat! Silakan salin.");
        }
      } else {
        toast.info("API Key berhasil dibuat, namun secret token tidak dikembalikan.");
      }

      await fetchStatus();
      if (onKeyCreated) {
        onKeyCreated();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuat API Key iOS Shortcut.";
      toast.error("Gagal membuat token", { detail: msg });
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleCopyUrl() {
    const copied = await copyToClipboard(apiUrl);
    if (copied) {
      setCopiedField("url");
      toast.success("API URL berhasil disalin!");
      setTimeout(() => setCopiedField((curr) => (curr === "url" ? null : curr)), 2500);
    } else {
      toast.error("Gagal menyalin API URL ke clipboard.");
    }
  }

  async function handleCopyToken(tokenToCopy?: string) {
    const token = tokenToCopy || createdToken;
    if (!token) {
      toast.warning("Silakan buat token terlebih dahulu dengan tombol 'Buat Token iOS Shortcut'.");
      return;
    }
    const copied = await copyToClipboard(token);
    if (copied) {
      setCopiedField("token");
      toast.success("Token berhasil disalin!", {
        detail: "Siap ditempelkan pada konfigurasi Shortcut iPhone.",
      });
      setTimeout(() => setCopiedField((curr) => (curr === "token" ? null : curr)), 3000);
    } else {
      toast.error("Gagal menyalin token ke clipboard.");
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
      className={`w-full max-w-full min-w-0 rounded-2xl border border-[#E0DDD6] bg-[#FFFFFF] shadow-sm overflow-hidden transition-all ${className}`}
    >
      {/* Header Banner */}
      <div className="w-full max-w-full min-w-0 bg-gradient-to-r from-[#1A1A1A] via-[#2A2826] to-[#1A1A1A] p-4 sm:p-6 text-white overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#10F5CC] backdrop-blur-xs ring-1 ring-white/20">
              <Smartphone className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Integrasi iOS Shortcut
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#10F5CC]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#10F5CC] ring-1 ring-inset ring-[#10F5CC]/30">
                  <Sparkles className="size-3" /> Zero Friction Capture
                </span>
              </div>
              <p className="mt-1 text-xs text-[#C5C0B8] max-w-xl leading-relaxed">
                Catat pengeluaran &amp; struk otomatis langsung dari Lembar Bagikan (Share Sheet) foto, Action Button, atau Back Tap di iPhone Anda.
              </p>
            </div>
          </div>

          {/* Status Indicator Badge */}
          <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0 self-stretch sm:self-start md:self-center bg-white/5 border border-white/10 p-2 sm:px-3 sm:py-2 rounded-xl backdrop-blur-xs min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {isOnline ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                )}
              </span>
              <div className="text-left min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#A09B93]">
                  Status Terkini
                </p>
                <p className="text-xs font-bold text-white truncate">
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-[#C5C0B8] hover:text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shrink-0 active:scale-95"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 space-y-6 w-full max-w-full min-w-0 overflow-hidden">
        {/* Token Alert / Newly Created Token Banner */}
        {createdToken ? (
          <div className="w-full max-w-full min-w-0 overflow-hidden break-all rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between gap-2.5 min-w-0">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-bold text-emerald-950">
                      Token Berhasil Dibuat &amp; Disalin!
                    </h4>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <Check className="size-3" /> Token Tersalin
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed break-words">
                    Tempelkan token ini saat diminta di layar instalasi Shortcut iPhone Anda.
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                    <code className="w-full max-w-full min-w-0 break-all font-mono select-all text-xs font-bold text-emerald-900 bg-white px-3 py-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                      {createdToken}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCopyToken(createdToken)}
                      className="min-h-[44px] shrink-0 text-xs font-bold gap-1.5 border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-900 active:scale-98"
                    >
                      {copiedField === "token" ? (
                        <>
                          <Check className="size-4 text-emerald-600" /> Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" /> Salin Ulang
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
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-emerald-700 hover:text-emerald-900 text-sm -mr-2 -mt-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Quick Actions: 2 Step Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          {/* Action 1: Generate / Copy Token */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FDFCFB] p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#1A1A1A]">
                  <KeyRound className="size-4 text-[#706A63]" />
                  Langkah 1: Token Akses
                </span>
                {totalLiveCredentials > 0 && (
                  <Badge variant="success" className="text-[10px]">
                    {totalLiveCredentials} Aktif
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-[#706A63] leading-relaxed">
                Buat token otentikasi akun Anda untuk ditempelkan ke Shortcut iPhone.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#EFECE6] flex items-center gap-2">
              <Button
                onClick={() => void handleCreateToken()}
                disabled={creatingKey}
                className="w-full sm:flex-1 bg-[#1A1A1A] hover:bg-[#333333] text-white text-xs font-bold py-2 gap-2 min-h-[44px] shadow-sm active:scale-98"
              >
                {creatingKey ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Sedang Membuat Token...
                  </>
                ) : (
                  <>
                    <Zap className="size-4 text-[#10F5CC]" /> Buat &amp; Salin Token
                  </>
                )}
              </Button>
              {createdToken && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyToken()}
                  aria-label="Salin Token"
                  className="min-h-[44px] min-w-[44px] text-xs font-semibold gap-1.5 border-[#D8D5CD] shrink-0"
                >
                  {copiedField === "token" ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Action 2: Install Official Shortcut */}
          <div className="flex flex-col justify-between rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <span className="flex items-center gap-1.5 text-sm font-bold text-blue-950">
                <Download className="size-4 text-blue-700" />
                Langkah 2: Pasang Shortcut
              </span>
              <p className="mt-2 text-xs text-blue-900/80 leading-relaxed">
                Buka tautan master template resmi di iPhone Anda, lalu tempelkan Token API saat diminta.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-blue-200/60 flex items-center justify-between gap-3">
              <a
                href={DEFAULT_SHORTCUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white px-4 py-2.5 text-xs font-bold transition-colors shadow-xs min-h-[44px] active:scale-98"
              >
                <Download className="size-4" />
                Pasang Shortcut di iOS (iCloud)
                <ExternalLink className="size-3.5 opacity-80" />
              </a>
            </div>
          </div>
        </div>

        {/* Collapsible: Advanced Developer Info */}
        <div className="pt-1 min-w-0">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="text-[#A09B93] text-[11px]">Tidak perlu konfigurasi manual URL</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowManualGuide((v) => !v)}
              className="text-xs text-[#706A63] hover:text-[#1A1A1A] gap-1 min-h-[44px]"
            >
              {showManualGuide ? "Tutup Info Endpoint" : "Opsi Pengembang & Endpoint URL"}
            </Button>
          </div>

          {showManualGuide && (
            <div className="mt-3 rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 text-xs space-y-3 animate-in fade-in duration-200 min-w-0 overflow-hidden">
              <div>
                <label className="text-[11px] font-semibold text-[#706A63] flex items-center justify-between">
                  <span>Direct Backend Endpoint URL</span>
                  <span className="text-[10px] text-[#A09B93]">POST request</span>
                </label>
                <div className="mt-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                  <div className="min-w-0 max-w-full flex-1 rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] px-3 py-2 text-xs font-mono text-[#3D3935] break-all select-all">
                    {apiUrl}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyUrl()}
                    className="shrink-0 text-xs font-semibold gap-1.5 min-h-[44px] border-[#D8D5CD] bg-white hover:bg-[#F4F3EE]"
                  >
                    {copiedField === "url" ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" /> Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Salin URL
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3-Step Visual Installation Guide */}
        <div className="pt-2 min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#706A63]">
              Petunjuk Pemasangan 3 Langkah
            </h4>
            <span className="text-[11px] text-[#A09B93]">Siap dalam 2 menit</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 min-w-0">
            {/* Step 1 */}
            <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#D5D0C5] transition-colors min-w-0">
              <div className="absolute top-2 right-3 text-2xl font-black text-[#E8E4DB] group-hover:text-[#DDD8CC] transition-colors">
                01
              </div>
              <div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold mb-3">
                  <Download className="size-4" />
                </div>
                <h5 className="text-sm font-bold text-[#1A1A1A]">
                  1. Pasang Shortcut
                </h5>
                <p className="mt-1 text-xs text-[#706A63] leading-relaxed">
                  Buka tautan resmi iCloud Shortcut di iPhone, iPad, atau Mac Anda, lalu ketuk tombol <strong>&ldquo;Get Shortcut&rdquo;</strong> untuk memasang.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#EFECE6] flex items-center text-[11px] font-semibold text-blue-700">
                <span>Dukungan iOS 16, 17, 18+</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#D5D0C5] transition-colors min-w-0">
              <div className="absolute top-2 right-3 text-2xl font-black text-[#E8E4DB] group-hover:text-[#DDD8CC] transition-colors">
                02
              </div>
              <div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold mb-3">
                  <KeyRound className="size-4" />
                </div>
                <h5 className="text-sm font-bold text-[#1A1A1A]">
                  2. Tempelkan Token API
                </h5>
                <p className="mt-1 text-xs text-[#706A63] leading-relaxed">
                  Saat prompt <em>Import Questions</em> muncul di iPhone, cukup tempelkan <strong>Token API</strong> yang telah Anda salin. URL Backend sudah otomatis terpasang.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#EFECE6] flex items-center text-[11px] font-semibold text-emerald-800">
                <span>Tersimpan aman di Keychain Apple</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#D5D0C5] transition-colors min-w-0">
              <div className="absolute top-2 right-3 text-2xl font-black text-[#E8E4DB] group-hover:text-[#DDD8CC] transition-colors">
                03
              </div>
              <div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-bold mb-3">
                  <Sparkles className="size-4" />
                </div>
                <h5 className="text-sm font-bold text-[#1A1A1A]">
                  3. Jalankan Otomatis
                </h5>
                <p className="mt-1 text-xs text-[#706A63] leading-relaxed">
                  Bagikan foto struk lewat <strong>Share Sheet</strong>, tahan <strong>Action Button</strong>, atau ketuk <strong>Back Tap</strong> untuk kirim transaksi seketika.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#EFECE6] flex items-center text-[11px] font-semibold text-purple-700">
                <span>OCR AI Staging &amp; 1-Click Approve</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Security Note */}
        <div className="rounded-xl bg-[#F4F3EE] p-3.5 flex items-center gap-3 text-xs text-[#5A5A5A]">
          <ShieldCheck className="size-4 text-[#10B981] shrink-0" />
          <p>
            Semua transaksi dari iOS Shortcut masuk ke <strong>Kotak Masuk (Staging Inbox)</strong> untuk diverifikasi sebelum dicatat ke buku besar keuangan Anda.
          </p>
        </div>
      </div>
    </div>
  );
}
