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
  Radio,
  ShieldCheck,
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
  "https://www.icloud.com/shortcuts/2baa4f48c7a04176b366b03798a248b3";

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
  const apiUrl = origin ? `${origin}/api/backend/ai/extract-transaction` : "https://your-domain.com/api/backend/ai/extract-transaction";

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
        toast.success("Token iOS Shortcut berhasil dibuat! Salin sekarang.");
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
    try {
      await navigator.clipboard.writeText(apiUrl);
      setCopiedField("url");
      toast.success("API URL berhasil disalin ke clipboard.");
      setTimeout(() => setCopiedField((curr) => (curr === "url" ? null : curr)), 2500);
    } catch {
      toast.error("Gagal menyalin API URL ke clipboard.");
    }
  }

  async function handleCopyToken(tokenToCopy?: string) {
    const token = tokenToCopy || createdToken;
    if (!token) {
      toast.warning("Silakan buat token terlebih dahulu dengan tombol 'Buat Token iOS Shortcut'.");
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      setCopiedField("token");
      toast.success("Token API berhasil disalin ke clipboard.");
      setTimeout(() => setCopiedField((curr) => (curr === "token" ? null : curr)), 2500);
    } catch {
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
      className={`rounded-2xl border border-[#E0DDD6] bg-[#FFFFFF] shadow-sm overflow-hidden transition-all ${className}`}
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1A1A1A] via-[#2A2826] to-[#1A1A1A] p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#10F5CC] backdrop-blur-xs ring-1 ring-white/20">
              <Smartphone className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-extrabold tracking-tight text-white">
                  Integrasi iOS Shortcut
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#10F5CC]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#10F5CC] ring-1 ring-inset ring-[#10F5CC]/30">
                  <Sparkles className="size-3" /> Zero Friction Capture
                </span>
              </div>
              <p className="mt-1 text-xs text-[#C5C0B8] max-w-xl leading-relaxed">
                Catat pengeluaran &amp; struk otomatis langsung dari Share Sheet foto, Action Button, atau Back Tap di iPhone Anda dengan sekali sentuh.
              </p>
            </div>
          </div>

          {/* Status Indicator Badge */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-center bg-white/5 border border-white/10 px-3 py-2 rounded-xl backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isOnline ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                )}
              </span>
              <div className="text-left">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#A09B93]">
                  Status Terkini
                </p>
                <p className="text-xs font-bold text-white">
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
              className="ml-1 p-1.5 text-[#C5C0B8] hover:text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6">
        {/* Token Alert / Newly Created Token Banner */}
        {createdToken ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Token Baru Berhasil Dibuat
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Salin token rahasia ini sekarang. Demi alasan keamanan, token tidak akan ditampilkan kembali setelah Anda meninggalkan halaman ini.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-mono text-xs font-bold text-emerald-950 break-all select-all shadow-xs">
                      {createdToken}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => void handleCopyToken(createdToken)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 gap-1.5 text-xs font-semibold h-8"
                    >
                      {copiedField === "token" ? (
                        <>
                          <Check className="size-3.5" /> Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" /> Salin Token
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCreatedToken(null)}
                className="text-emerald-700 hover:text-emerald-950 text-xs font-medium px-2 py-1 rounded"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : null}

        {/* Action Controls: 1-Click Generate & Copy Credentials */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Quick Action 1: Create Key */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FDFCFB] p-4 shadow-2xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A]">
                  <KeyRound className="size-4 text-[#706A63]" />
                  1-Click Token Generator
                </span>
                {totalLiveCredentials > 0 && (
                  <Badge variant="success" className="text-[10px]">
                    {totalLiveCredentials} Aktif
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 text-xs text-[#706A63] leading-relaxed">
                Buat API Key instan dengan nama <strong>iOS Shortcut</strong> dan hak akses <code className="text-[11px] bg-[#EFECE6] px-1 py-0.5 rounded font-mono">transactions:write</code>.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#EFECE6]">
              <Button
                onClick={() => void handleCreateToken()}
                disabled={creatingKey}
                className="w-full bg-[#1A1A1A] hover:bg-[#333333] text-white text-xs font-bold py-2 gap-2 h-10 shadow-sm"
              >
                {creatingKey ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Sedang Membuat Token...
                  </>
                ) : (
                  <>
                    <Zap className="size-4 text-[#10F5CC]" /> Buat Token iOS Shortcut
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Action 2: Copy API URL & Token */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FDFCFB] p-4 shadow-2xs">
            <div className="space-y-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A]">
                <Radio className="size-4 text-[#706A63]" />
                Endpoint &amp; Kredensial Integrasi
              </span>

              {/* Endpoint Copy Row */}
              <div>
                <label className="text-[11px] font-semibold text-[#706A63] flex items-center justify-between">
                  <span>API Endpoint URL (AI Extraction)</span>
                  <span className="text-[10px] text-[#A09B93]">POST request</span>
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-mono text-[#3D3935] truncate select-all">
                    {apiUrl}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyUrl()}
                    className="shrink-0 text-xs font-semibold gap-1.5 h-8 border-[#D8D5CD] hover:bg-[#F4F3EE]"
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

              {/* Token Copy Helper */}
              <div>
                <label className="text-[11px] font-semibold text-[#706A63] flex items-center justify-between">
                  <span>Auth Token / Secret</span>
                  <span className="text-[10px] text-[#A09B93]">Bearer / Header API-Key</span>
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-mono text-[#706A63] truncate">
                    {createdToken ? "••••••••••••••••••••••••••••" : totalLiveCredentials > 0 ? "Token aktif terdaftar di Vault" : "Belum ada token (klik Buat Token)"}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyToken()}
                    disabled={!createdToken}
                    className="shrink-0 text-xs font-semibold gap-1.5 h-8 border-[#D8D5CD] hover:bg-[#F4F3EE] disabled:opacity-50"
                  >
                    {copiedField === "token" ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" /> Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Salin Token
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Official iCloud Shortcut Button */}
            <div className="mt-4 pt-3 border-t border-[#EFECE6] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <span className="text-[11px] text-[#706A63] font-medium hidden sm:inline">
                Template Resmi Apple Shortcut:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualGuide((v) => !v)}
                  className="text-xs text-[#5A5A5A] hover:text-[#1A1A1A] gap-1 h-8"
                >
                  {showManualGuide ? "Tutup Detail Blok" : "Lihat Susunan Blok Aksi"}
                </Button>
                {DEFAULT_SHORTCUT_URL && DEFAULT_SHORTCUT_URL !== "https://www.icloud.com/shortcuts/" ? (
                  <a
                    href={DEFAULT_SHORTCUT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white px-4 py-2 text-xs font-bold transition-colors shadow-xs"
                  >
                    <Download className="size-3.5" />
                    Pasang Shortcut di iOS (iCloud)
                    <ExternalLink className="size-3.5 opacity-80" />
                  </a>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setShowManualGuide(true);
                      toast.info("Tautan iCloud Shortcut spesifik belum dipasang. Lihat susunan aksi di bawah atau set NEXT_PUBLIC_IOS_SHORTCUT_URL.");
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white px-4 py-2 text-xs font-bold transition-colors shadow-xs"
                  >
                    <Download className="size-3.5" />
                    Pasang Shortcut di iOS (iCloud)
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Manual Actions Breakdown Section */}
        {showManualGuide && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Sparkles className="size-4 text-blue-600" />
                  Susunan Aksi Shortcut di Aplikasi Shortcuts iOS
                </h4>
                <p className="text-xs text-[#5A5A5A] mt-1">
                  Jika Anda menyusun sendiri di aplikasi Shortcuts iPhone atau ingin membagikan tautan iCloud:
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowManualGuide(false)}
                className="text-xs text-[#706A63] h-7 px-2"
              >
                Tutup
              </Button>
            </div>

            <div className="grid gap-2.5 text-xs">
              <div className="rounded-lg bg-white p-3 border border-blue-100 space-y-1">
                <span className="font-bold text-[#1A1A1A]">1. Terima Input (Share Sheet):</span>
                <p className="text-[#5A5A5A]">Aktifkan <strong>&ldquo;Show in Share Sheet&rdquo;</strong> dengan tipe input: <em>Images / Media / Text</em>.</p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-blue-100 space-y-1">
                <span className="font-bold text-[#1A1A1A]">2. Base64 Encode (Jika Foto):</span>
                <p className="text-[#5A5A5A]">Aksi <strong>&ldquo;Base64 Encode&rdquo;</strong> dari input gambar.</p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-blue-100 space-y-1">
                <span className="font-bold text-[#1A1A1A]">3. Get Contents of URL (POST):</span>
                <p className="text-[#5A5A5A]">
                  URL: <code className="bg-[#EFECE6] px-1 py-0.5 rounded font-mono">{apiUrl}</code><br />
                  Method: <strong>POST</strong><br />
                  Headers: <code className="bg-[#EFECE6] px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;TOKEN_ANDA&gt;</code>, <code className="bg-[#EFECE6] px-1 py-0.5 rounded font-mono">Content-Type: application/json</code><br />
                  Body JSON: <code className="bg-[#EFECE6] px-1 py-0.5 rounded font-mono">&#123; &quot;image_base64&quot;: Base64 Encoded, &quot;source&quot;: &quot;ios&quot; &#125;</code>
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 border border-blue-100 space-y-1">
                <span className="font-bold text-[#1A1A1A]">4. Tampilkan Notifikasi:</span>
                <p className="text-[#5A5A5A]">Aksi <strong>&ldquo;Get Dictionary Value: summary_message&rdquo;</strong> &rarr; <strong>&ldquo;Show Notification&rdquo;</strong>.</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
              💡 <strong>Cara Bagikan iCloud Link:</strong> Tekan titik tiga pada Shortcut di iPhone &gt; <em>Share</em> &gt; <em>Copy iCloud Link</em>. Kirimkan tautan tersebut agar tombol &ldquo;Pasang Shortcut di iOS&rdquo; bisa langsung 1-klik untuk semua user.
            </div>
          </div>
        )}

        {/* 3-Step Visual Installation Guide */}
        <div className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#706A63]">
              Petunjuk Pemasangan 3 Langkah
            </h4>
            <span className="text-[11px] text-[#A09B93]">Siap dalam 2 menit</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Step 1 */}
            <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#D5D0C5] transition-colors">
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
            <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#D5D0C5] transition-colors">
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
            <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#D5D0C5] transition-colors">
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
