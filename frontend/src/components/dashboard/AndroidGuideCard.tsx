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
  Layers,
  Bot,
  Radio,
  ArrowRight,
} from "lucide-react";
import {
  api,
  type WebhookToken,
  type DeviceRegistration,
  type AndroidTestResult,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QRCodeDialog } from "@/components/ui/qr-code-dialog";
import { copyToClipboard } from "@/components/dashboard/iOSShortcutGuideCard";
import { generateMacroDroidTemplate } from "@/lib/macrodroid-template";

interface AndroidGuideCardProps {
  id?: string;
  onKeyCreated?: () => void;
  className?: string;
}

const PLAY_STORE_MACRODROID_URL =
  "https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid";

export function AndroidGuideCard({
  id = "android-guide",
  onKeyCreated,
  className = "",
}: AndroidGuideCardProps) {
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"url" | "token" | "fullUrl" | null>(null);
  const [activeAndroidWebhooks, setActiveAndroidWebhooks] = useState<WebhookToken[]>([]);
  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [testResult, setTestResult] = useState<AndroidTestResult | null>(null);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Calculate API endpoint URL
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookBaseUrl = origin
    ? `${origin}/api/backend/integrations/android/notifications`
    : "https://satset-api.vercel.app/api/backend/integrations/android/notifications";

  // Full single-line URL with embedded query token
  const fullWebhookUrl = createdToken
    ? `${webhookBaseUrl}?token=${createdToken}`
    : webhookBaseUrl;

  const fetchStatus = useCallback(async () => {
    try {
      const [tokens, devList] = await Promise.allSettled([
        api.webhookTokens({ include_revoked: false }),
        api.androidDevices(),
      ]);

      const validTokens = tokens.status === "fulfilled" ? tokens.value : [];
      const validDevices = devList.status === "fulfilled" ? devList.value : [];

      const androidTokens = validTokens.filter(
        (t) =>
          !t.revoked_at &&
          (t.source === "android" ||
            t.name.toLowerCase().includes("android") ||
            t.name.toLowerCase().includes("macrodroid"))
      );

      setActiveAndroidWebhooks(androidTokens);
      setDevices(validDevices);
    } catch (err) {
      console.error("Gagal memuat status integrasi Android:", err);
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

  async function handleGenerateWebhookKey() {
    setCreatingKey(true);
    try {
      const created = await api.createWebhookToken({
        name: "MacroDroid Android",
        source: "android",
      });

      if (created.token) {
        setCreatedToken(created.token);
        const generatedUrl = `${webhookBaseUrl}?token=${created.token}`;
        const copied = await copyToClipboard(generatedUrl);
        if (copied) {
          setCopiedField("fullUrl");
          toast.success("Kunci Otomasi Android Berhasil Dibuat!", {
            detail: "Tautan webhook lengkap dengan token telah disalin ke clipboard.",
          });
          setTimeout(() => setCopiedField((curr) => (curr === "fullUrl" ? null : curr)), 3500);
        } else {
          toast.success("Kunci webhook berhasil dibuat! Silakan salin tautan di bawah.");
        }
      } else {
        toast.info("Kunci webhook berhasil dibuat, silakan periksa daftar kredensial.");
      }

      await fetchStatus();
      if (onKeyCreated) {
        onKeyCreated();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuat kunci otomasi Android.";
      toast.error("Gagal membuat kunci otomasi", { detail: msg });
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleCopyFullUrl() {
    const copied = await copyToClipboard(fullWebhookUrl);
    if (copied) {
      setCopiedField("fullUrl");
      toast.success("Tautan Webhook Lengkap Berhasil Disalin!");
      setTimeout(() => setCopiedField((curr) => (curr === "fullUrl" ? null : curr)), 2500);
    } else {
      toast.error("Gagal menyalin tautan.");
    }
  }

  function handleDownloadTemplate() {
    try {
      const macroTemplate = generateMacroDroidTemplate(fullWebhookUrl, "Ponsel Android");
      const jsonString = JSON.stringify(macroTemplate, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "zero-friction-erp.macro";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast.success("Template MacroDroid Berhasil Diunduh!", {
        detail: "Impor file .macro ke MacroDroid di Android untuk mengaktifkan pendengar notifikasi.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengunduh template.";
      toast.error("Gagal mengunduh template", { detail: msg });
    }
  }

  async function handleTestPush() {
    setTestingPush(true);
    setTestResult(null);
    try {
      const simulatedPayload = {
        device_id: "test_android_phone",
        app_name: "GoPay",
        package_name: "com.gojek.app",
        title: "Pembayaran Berhasil",
        text: "Kamu berhasil bayar Rp35.000 ke Kopi Kenangan",
        posted_at: new Date().toISOString(),
      };

      const result = await api.androidTestPush(simulatedPayload);
      setTestResult(result);

      toast.success("Uji Notifikasi Berhasil Dijalankan!", {
        detail: `Status: ${result.status} · Mesin Anti-Duplikasi: ${result.dedup?.action || "pass"}`,
      });

      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim notifikasi simulasi.";
      toast.error("Uji notifikasi gagal", { detail: msg });
    } finally {
      setTestingPush(false);
    }
  }

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return "Belum pernah aktif";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Belum pernah aktif";

    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const hasConnectedDevices = devices.length > 0;
  const isOnline = hasConnectedDevices || activeAndroidWebhooks.length > 0;
  const latestDeviceSeen = devices.reduce<string | null>((latest, d) => {
    if (!d.last_seen_at) return latest;
    if (!latest) return d.last_seen_at;
    return new Date(d.last_seen_at).getTime() > new Date(latest).getTime()
      ? d.last_seen_at
      : latest;
  }, null);

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
              <Bot className="size-5 sm:size-6 text-[#1A1A1A]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1A1A1A]">
                  Integrasi Android (MacroDroid)
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF9F5] border border-[#E8E6E1] px-2.5 py-0.5 text-[11px] font-semibold text-[#047857]">
                  <Sparkles className="size-3 text-[#047857]" /> 0-Tap Notification Listener
                </span>
              </div>
              <p className="text-xs text-[#756f64] mt-1 leading-relaxed">
                Mendeteksi notifikasi pembayaran dari GoPay, OCTO Mobile, ShopeePay, dan blu secara pasif &amp; instan tanpa sentuhan.
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
                  Status Integrasi
                </span>
                <p className="text-[10px] text-[#756f64] truncate mt-0.5">
                  {loading
                    ? "Memeriksa..."
                    : hasConnectedDevices
                    ? `${devices.length} Perangkat (${formatDateTime(latestDeviceSeen)})`
                    : activeAndroidWebhooks.length > 0
                    ? "Webhook Siap (Menunggu Notifikasi)"
                    : "Belum Dikonfigurasi"}
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
                      Kunci Otomasi Android Berhasil Dibuat!
                    </h4>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E8E6E1] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
                      <Check className="size-3" /> Token Siap Dipakai
                    </span>
                  </div>
                  <p className="text-xs text-[#756f64] mt-1 leading-relaxed break-words">
                    Gunakan tautan lengkap di bawah ini untuk MacroDroid, atau langsung klik tombol Unduh Template pada Langkah 2.
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                    <code className="w-full max-w-full min-w-0 break-all font-mono select-all text-xs font-bold text-[#1A1A1A] bg-white px-3 py-2.5 rounded-lg border border-[#E8E6E1] shadow-2xs">
                      {fullWebhookUrl}
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
          {/* Langkah 1: Buat Kunci Otomasi */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A1A1A]">
                  <KeyRound className="size-4 text-[#756f64]" />
                  Langkah 1: Kunci Otomasi
                </span>
                {activeAndroidWebhooks.length > 0 && (
                  <Badge variant="success" className="text-[10px]">
                    {activeAndroidWebhooks.length} Aktif
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-[#756f64] leading-relaxed">
                Buat token webhook khusus Android untuk otentikasi MacroDroid secara aman dan otomatis.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8E6E1] flex flex-col gap-2">
              <Button
                onClick={() => void handleGenerateWebhookKey()}
                disabled={creatingKey}
                className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white text-xs font-bold py-2 gap-2 min-h-[44px] shadow-xs active:scale-98"
              >
                {creatingKey ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Menyiapkan Kunci...
                  </>
                ) : (
                  <>
                    <Zap className="size-4" /> Buat &amp; Salin Kunci
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Langkah 2: Pasang MacroDroid & Unduh Template */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A1A1A]">
                <Download className="size-4 text-[#756f64]" />
                Langkah 2: Pasang &amp; Template
              </span>
              <p className="mt-2 text-xs text-[#756f64] leading-relaxed">
                Pasang MacroDroid dari Play Store, lalu unduh file template berparameter token Anda.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8E6E1] flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={PLAY_STORE_MACRODROID_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#FAF9F5] hover:bg-[#F0EEE9] text-[#1A1A1A] border border-[#E0DDD6] px-3 py-2 text-xs font-bold transition-colors shadow-2xs min-h-[44px] active:scale-98 text-center"
                >
                  <ExternalLink className="size-3.5 text-[#5A5A5A]" />
                  Play Store
                </a>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQrOpen(true)}
                  title="Pindai QR Code di Android"
                  className="min-h-[44px] px-3 text-xs font-bold gap-1.5 border-[#E0DDD6] bg-white hover:bg-[#F0EEE9] text-[#1A1A1A] shrink-0"
                >
                  <QrCode className="size-4 text-[#0071E3]" />
                  <span className="hidden sm:inline">Scan QR</span>
                </Button>
              </div>

              <Button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white text-xs font-bold py-2 gap-2 min-h-[44px] shadow-xs active:scale-98"
              >
                <Download className="size-4" /> Unduh Template .macro
              </Button>
            </div>
          </div>

          {/* Langkah 3: Uji Notifikasi (Test Push) */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 shadow-2xs min-w-0">
            <div>
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A1A1A]">
                <Activity className="size-4 text-[#756f64]" />
                Langkah 3: Uji Notifikasi
              </span>
              <p className="mt-2 text-xs text-[#756f64] leading-relaxed">
                Kirim simulasi notifikasi transaksi GoPay untuk menguji parser dan mesin anti-duplikasi.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E8E6E1] flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTestPush()}
                disabled={testingPush}
                className="w-full min-h-[44px] text-xs font-bold gap-2 border-[#E0DDD6] bg-white hover:bg-[#F0EEE9] text-[#1A1A1A] active:scale-98"
              >
                {testingPush ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin text-[#047857]" /> Mengirim Simulasi...
                  </>
                ) : (
                  <>
                    <Radio className="size-3.5 text-[#047857]" /> Kirim Notifikasi Simulasi
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Diagnosis Test Result Card */}
        {testResult ? (
          <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-300 min-w-0">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1] min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="size-4 text-[#047857]" />
                <h4 className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
                  Hasil Diagnosa Notifikasi Simulasi
                </h4>
              </div>
              <Badge
                variant={
                  testResult.status === "accepted"
                    ? "success"
                    : testResult.status === "filtered"
                    ? "default"
                    : "warning"
                }
                className="text-[10px]"
              >
                Status: {testResult.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-[#E8E6E1]">
                <span className="text-[10px] text-[#756f64] block font-semibold">Nominal</span>
                <span className="text-sm font-bold text-[#1A1A1A] mt-0.5 block">
                  {testResult.parsed?.amount
                    ? new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(testResult.parsed.amount)
                    : "—"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-[#E8E6E1]">
                <span className="text-[10px] text-[#756f64] block font-semibold">Merchant / Tujuan</span>
                <span className="text-sm font-bold text-[#1A1A1A] mt-0.5 block truncate">
                  {testResult.parsed?.merchant || "—"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-[#E8E6E1]">
                <span className="text-[10px] text-[#756f64] block font-semibold">Dompet Terpetakan</span>
                <span className="text-sm font-bold text-[#047857] mt-0.5 block truncate">
                  {testResult.wallet_match ? testResult.wallet_match.name : "Belum terpetakan"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-[#E8E6E1]">
                <span className="text-[10px] text-[#756f64] block font-semibold">Mesin Anti-Duplikasi</span>
                <span className="text-sm font-bold text-[#1A1A1A] mt-0.5 block">
                  {testResult.dedup?.action ? (
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3 text-[#756f64]" />
                      {testResult.dedup.action.toUpperCase()}
                      {testResult.dedup.layer ? ` (Lapis ${testResult.dedup.layer})` : ""}
                    </span>
                  ) : (
                    "Lolos (Unik)"
                  )}
                </span>
              </div>
            </div>

            {testResult.filter?.is_filtered && (
              <p className="mt-3 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Pesan ini disaring otomatis: {testResult.filter.reason}
              </p>
            )}
          </div>
        ) : null}

        {/* Perangkat Terhubung (Device Monitoring Section) */}
        <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 sm:p-5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-[#E8E6E1] min-w-0">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-[#5A5A5A]" />
              <h4 className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
                Perangkat Android Terhubung
              </h4>
            </div>
            <span className="text-xs text-[#756f64]">
              {devices.length} perangkat terdaftar
            </span>
          </div>

          <div className="pt-3">
            {devices.length === 0 ? (
              <div className="p-4 sm:p-6 text-center rounded-lg bg-white border border-dashed border-[#D1CEC7]">
                <p className="text-xs font-semibold text-[#1A1A1A]">
                  Belum ada perangkat terhubung
                </p>
                <p className="text-[11px] text-[#756f64] mt-1 max-w-md mx-auto leading-relaxed">
                  Notifikasi pertama yang dikirimkan oleh MacroDroid akan otomatis mendaftarkan perangkat Android Anda di sini secara instan.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-3.5 rounded-xl bg-white border border-[#E8E6E1] shadow-2xs flex flex-col justify-between gap-3 min-w-0"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1A1A1A] truncate">
                          {device.device_label || device.device_id}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                          {device.platform.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#756f64] font-mono mt-1 truncate">
                        ID: {device.device_id}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#F0EEE9] flex items-center justify-between text-[11px] text-[#756f64]">
                      <span>Aktif: {formatDateTime(device.last_seen_at)}</span>
                      <span className="font-semibold text-[#1A1A1A]">
                        {device.events_count} notifikasi
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Collapsible: Advanced Technical Info */}
        <div className="pt-2 min-w-0">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="text-[#756f64] text-[11px]">
              Metode integrasi: Webhook HTTP POST dengan Token Query (?token=zfe_wh_...)
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowManualGuide((v) => !v)}
              className="text-xs text-[#756f64] hover:text-[#1A1A1A] gap-1 min-h-[44px]"
            >
              {showManualGuide ? "Tutup Detail Teknis" : "Opsi Lanjutan & Skema Payload"}
            </Button>
          </div>

          {showManualGuide && (
            <div className="mt-3 rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4 text-xs space-y-3 animate-in fade-in duration-200 min-w-0 overflow-hidden">
              <div>
                <label className="text-[11px] font-semibold text-[#756f64] flex items-center justify-between">
                  <span>Base Webhook Endpoint URL</span>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(webhookBaseUrl)}
                    className="text-[#0071E3] hover:underline cursor-pointer"
                  >
                    Salin Base URL
                  </button>
                </label>
                <div className="mt-1 font-mono text-[11px] bg-white p-2.5 rounded-lg border border-[#E8E6E1] break-all select-all">
                  {webhookBaseUrl}
                </div>
              </div>

              {createdToken && (
                <div>
                  <label className="text-[11px] font-semibold text-[#756f64] flex items-center justify-between">
                    <span>Secret Webhook Token</span>
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

              <div>
                <label className="text-[11px] font-semibold text-[#756f64] block mb-1">
                  Format Payload JSON MacroDroid
                </label>
                <pre className="font-mono text-[11px] bg-white p-3 rounded-lg border border-[#E8E6E1] overflow-x-auto text-[#1A1A1A]">
{`{
  "device_id": "Ponsel Android",
  "app_name": "{notification_app_name}",
  "package_name": "{notification_package_name}",
  "title": "{notification_title}",
  "text": "{notification_text}",
  "posted_at": "{system_time_iso}"
}`}
                </pre>
              </div>

              <p className="text-[11px] text-[#706A63] leading-relaxed">
                Aplikasi yang didukung: <strong>GoPay</strong> (com.gojek.app), <strong>CIMB OCTO Mobile</strong> (com.cimb.octo / com.cimbniaga.octo), <strong>ShopeePay</strong> (com.shopeepay / id.co.shopee), dan <strong>blu by BCA</strong> (com.blu.app / id.co.bca.blu).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal Dialog */}
      <QRCodeDialog
        open={isQrOpen}
        onOpenChange={setIsQrOpen}
        value={fullWebhookUrl}
        title="Pindai Tautan Webhook di Android"
        description="Arahkan scanner atau kamera ponsel Android ke kode QR untuk menyalin webhook URL lengkap beserta token otentikasi."
      />
    </div>
  );
}
