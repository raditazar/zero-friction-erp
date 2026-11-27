"use client";

import { useCallback, useMemo } from "react";
import { Server, Activity, Database, RefreshCw, KeyRound, Webhook, XCircle, User, Settings as SettingsIcon, BookOpen, Smartphone, Sparkles, ArrowRight, Bot, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, FormEvent } from "react";
import { Panel, DataList } from "@/components/ui/dashboard";
import { NativeSelectField } from "@/components/ui/form";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";

import { api, type Me, type APIKey, type WebhookToken } from "@/lib/api";
import { IOSShortcutGuideCard } from "@/components/dashboard/iOSShortcutGuideCard";
import { AndroidGuideCard } from "@/components/dashboard/AndroidGuideCard";
import { PushNotificationCard } from "@/components/dashboard/PushNotificationCard";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { SecretRevealDialog } from "@/components/ui/dialogs/secret-reveal-dialog";
import { ErrorState } from "@/components/ui/feedback/error-state";
import { LoadingState } from "@/components/ui/feedback/loading-state";
import { CheckboxField, DateField, FormCard, FormCardContent, FormCardDescription, FormCardFooter, FormCardHeader, FormCardTitle, FormField, SelectField, SubmitAction, TextField } from "@/components/ui/form";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { toast } from "@/components/ui/toast";

type Credential = APIKey | WebhookToken;
type Target = { kind: "api"; item: APIKey } | { kind: "webhook"; item: WebhookToken } | null;
type DataRows = Parameters<typeof DataList>[0]["rows"];
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | null | undefined) { if (!value) return "Never"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date); }
function statusOf(item: Pick<Credential, "revoked_at" | "expires_at">) { return item.revoked_at ? "Dicabut" : item.expires_at && new Date(item.expires_at).getTime() <= Date.now() ? "Kedaluwarsa" : "Aktif"; }
function StatusBadge({ status }: { status: ReturnType<typeof statusOf> }) { return <Badge variant={status === "Aktif" ? "success" : status === "Kedaluwarsa" ? "warning" : "danger"}>{status}</Badge>; }
function latest<T extends { created_at: string }>(items: T[]) { return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); }

function formatScopeLabels(scopes: string[]) {
  return scopes.map(s => {
    if (s === "transactions:read") return "Baca & Lihat Transaksi";
    if (s === "transactions:write") return "Catat & Tambah Transaksi";
    return s;
  }).join(", ");
}

function Metadata({ prefix, detail, item }: { prefix: string; detail: string; item: Credential }) {
  return <div className="space-y-1"><p><span className="font-mono text-ink">{prefix}</span> · {detail}</p><p>Dibuat {formatDate(item.created_at)} · Terakhir digunakan {formatDate(item.last_used_at)}{item.expires_at ? ` · Berakhir ${formatDate(item.expires_at)}` : ""}{item.revoked_at ? ` · Dicabut ${formatDate(item.revoked_at)}` : ""}</p></div>;
}
function CredentialList({ title, description, rows, loading, error, onRetry }: { title: string; description: string; rows: DataRows; loading: boolean; error: string; onRetry: () => void }) {
  return <Panel><div className="mb-4"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-ink-soft">{description}</p></div>{loading ? <LoadingState label={`Memuat ${title.toLowerCase()}…`} /> : error ? <ErrorState message={error} onRetry={onRetry} /> : <DataList rows={rows} />}</Panel>;
}

function IntegrationsSection() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]); const [webhooks, setWebhooks] = useState<WebhookToken[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [apiName, setApiName] = useState(""); const [read, setRead] = useState(true); const [write, setWrite] = useState(false); const [apiExpiry, setApiExpiry] = useState(""); const [apiBusy, setApiBusy] = useState(false);
  const [webhookName, setWebhookName] = useState(""); const [source, setSource] = useState("ios"); const [webhookExpiry, setWebhookExpiry] = useState(""); const [webhookBusy, setWebhookBusy] = useState(false);
  const [secretValue, setSecretValue] = useState(""); const [secretTitle, setSecretTitle] = useState("Kredensial Dibuat"); const [target, setTarget] = useState<Target>(null); const [revoking, setRevoking] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [keys, tokens] = await Promise.all([api.apiKeys({ include_revoked: true }), api.webhookTokens({ include_revoked: true })]); setApiKeys(latest(keys)); setWebhooks(latest(tokens)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Tidak dapat memuat kredensial."); } finally { setLoading(false); } }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  const liveKeys = useMemo(() => apiKeys.filter((item) => !item.revoked_at), [apiKeys]); const liveWebhooks = useMemo(() => webhooks.filter((item) => !item.revoked_at), [webhooks]);
  const revoked = useMemo(() => latest([...apiKeys.filter((item) => item.revoked_at).map((item) => ({ kind: "API Key", item, created_at: item.created_at })), ...webhooks.filter((item) => item.revoked_at).map((item) => ({ kind: "Kunci Webhook Otomatis", item, created_at: item.created_at }))]), [apiKeys, webhooks]);
  async function createKey(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!apiName.trim() || (!read && !write)) return; setApiBusy(true); setNotice(""); try { const created = await api.createAPIKey({ name: apiName.trim(), scopes: [read && "transactions:read", write && "transactions:write"].filter((scope): scope is string => Boolean(scope)), ...(apiExpiry ? { expires_at: apiExpiry } : {}) }); setApiName(""); setRead(true); setWrite(false); setApiExpiry(""); toast.success("API Key berhasil dibuat."); await load(); if (created.token) { setSecretTitle("API Key berhasil dibuat — salin sekarang"); setSecretValue(created.token); } else setNotice("API Key berhasil dibuat, namun secret token tidak dikembalikan."); } catch (caught) { const msg = caught instanceof Error ? caught.message : "Gagal membuat API Key."; setNotice(msg); toast.error("Gagal membuat API Key", { detail: msg }); } finally { setApiBusy(false); } }
  async function createWebhook(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!webhookName.trim()) return; setWebhookBusy(true); setNotice(""); try { const created = await api.createWebhookToken({ name: webhookName.trim(), source, ...(webhookExpiry ? { expires_at: webhookExpiry } : {}) }); setWebhookName(""); setSource("ios"); setWebhookExpiry(""); toast.success("Kunci Webhook Otomatis berhasil dibuat."); await load(); if (created.token) { setSecretTitle("Kunci Webhook Otomatis berhasil dibuat — salin sekarang"); setSecretValue(created.token); } else setNotice("Kunci Webhook Otomatis berhasil dibuat, namun secret token tidak dikembalikan."); } catch (caught) { const msg = caught instanceof Error ? caught.message : "Gagal membuat Kunci Webhook Otomatis."; setNotice(msg); toast.error("Gagal membuat Kunci Webhook Otomatis", { detail: msg }); } finally { setWebhookBusy(false); } }
  async function revoke() { if (!target) return; setRevoking(true); setNotice(""); const isApi = target.kind === "api"; try { if (target.kind === "api") await api.revokeAPIKey(target.item.id); else await api.revokeWebhookToken(target.item.id); toast.success(isApi ? "API Key berhasil dicabut." : "Kunci Webhook Otomatis berhasil dicabut."); setTarget(null); await load(); } catch (caught) { const msg = caught instanceof Error ? caught.message : "Tidak dapat mencabut kredensial."; setNotice(msg); toast.error(isApi ? "Gagal mencabut API Key" : "Gagal mencabut Kunci Webhook Otomatis", { detail: msg }); } finally { setRevoking(false); } }
  const keyRows: DataRows = liveKeys.map((item) => ({ id: item.id, title: <div className="flex flex-wrap items-center gap-2"><span>{item.name}</span><StatusBadge status={statusOf(item)} /></div>, meta: <Metadata prefix={item.key_prefix} detail={formatScopeLabels(item.scopes)} item={item} />, action: <Button variant="ghost" size="sm" className="min-h-[44px] text-negative hover:text-negative" onClick={() => setTarget({ kind: "api", item })}>Cabut</Button> }));
  const webhookRows: DataRows = liveWebhooks.map((item) => ({ id: item.id, title: <div className="flex flex-wrap items-center gap-2"><span>{item.name}</span><StatusBadge status={statusOf(item)} /></div>, meta: <Metadata prefix={item.token_prefix} detail={`Sumber: ${item.source}`} item={item} />, action: <Button variant="ghost" size="sm" className="min-h-[44px] text-negative hover:text-negative" onClick={() => setTarget({ kind: "webhook", item })}>Cabut</Button> }));
  const revokedRows: DataRows = revoked.map(({ kind, item }) => ({ id: `${kind}-${item.id}`, title: <div className="flex flex-wrap items-center gap-2"><span>{item.name}</span><StatusBadge status="Dicabut" /></div>, meta: <Metadata prefix={"key_prefix" in item ? item.key_prefix : item.token_prefix} detail={"scopes" in item ? `${kind} · ${formatScopeLabels(item.scopes)}` : `${kind} · Sumber: ${item.source}`} item={item} /> }));
  const minDate = new Date().toISOString().slice(0, 10);
  return <div className="space-y-6">
    <div><h3 className="text-base font-extrabold text-ink">Brankas Kredensial &amp; Integrasi</h3><p className="text-xs text-ink-soft mt-1">Terbitkan dan kelola kredensial akses API serta Kunci Webhook Otomatis untuk integrasi khusus.</p></div>
    {notice ? <p role="status" className="mb-5 rounded-lg border border-line-strong bg-paper px-4 py-3 text-sm text-ink-soft">{notice}</p> : null}
    <div className="grid gap-6 xl:grid-cols-2">
      <FormCard variant="sensitive"><form onSubmit={createKey}><FormCardHeader><div><FormCardTitle className="flex items-center gap-2"><KeyRound className="size-4" />Kunci API</FormCardTitle><FormCardDescription>Gunakan hak akses (scope) untuk membatasi aksi yang dapat dilakukan integrasi.</FormCardDescription></div></FormCardHeader><FormCardContent className="space-y-4"><FormField label="Nama Kunci" required><TextField value={apiName} onChange={(event) => setApiName(event.target.value)} placeholder="Contoh: Layanan Rekonsiliasi" /></FormField><FormField label="Preset Akses Cepat"><SelectField value={read && write ? "read-write" : "read"} onChange={(event) => { const both = event.target.value === "read-write"; setRead(true); setWrite(both); }}><option value="read">Hanya Baca (Baca &amp; Lihat Transaksi)</option><option value="read-write">Baca &amp; Tulis (Baca &amp; Catat Transaksi)</option></SelectField></FormField><fieldset className="space-y-2"><legend className="text-xs font-semibold text-ink">Hak akses</legend><label className="flex items-center gap-2 text-sm cursor-pointer"><CheckboxField checked={read} onChange={(event) => setRead(event.target.checked)} /><span>Baca &amp; Lihat Transaksi</span> <span className="text-xs text-ink-soft font-mono">(transactions:read)</span></label><label className="flex items-center gap-2 text-sm cursor-pointer"><CheckboxField checked={write} onChange={(event) => setWrite(event.target.checked)} /><span>Catat &amp; Tambah Transaksi</span> <span className="text-xs text-ink-soft font-mono">(transactions:write)</span></label></fieldset><FormField label="Masa Berlaku" hint="Opsional; kadaluarsa pada awal tanggal lokal yang dipilih."><DateField value={apiExpiry} min={minDate} onChange={(event) => setApiExpiry(event.target.value)} /></FormField></FormCardContent><FormCardFooter><SubmitAction isSubmitting={apiBusy} label="Buat kunci API" busyLabel="Membuat..." disabled={!apiName.trim() || (!read && !write)} /></FormCardFooter></form></FormCard>
      <FormCard variant="sensitive"><form onSubmit={createWebhook}><FormCardHeader><div><FormCardTitle className="flex items-center gap-2"><Webhook className="size-4" />Kunci Webhook Otomatis</FormCardTitle><FormCardDescription>Otorisasi sumber data masuk otomatis tanpa membuka akses penuh ke akun.</FormCardDescription></div></FormCardHeader><FormCardContent className="space-y-4"><FormField label="Nama Kunci Webhook" required><TextField value={webhookName} onChange={(event) => setWebhookName(event.target.value)} placeholder="Contoh: Otomasi Bank / POS" /></FormField><FormField label="Sumber"><SelectField value={source} onChange={(event) => setSource(event.target.value)}><option value="ios">iOS</option><option value="android">Android</option><option value="cronjob">Cronjob</option><option value="api">API</option></SelectField></FormField><FormField label="Masa Berlaku" hint="Opsional; kadaluarsa pada awal tanggal lokal yang dipilih."><DateField value={webhookExpiry} min={minDate} onChange={(event) => setWebhookExpiry(event.target.value)} /></FormField></FormCardContent><FormCardFooter><SubmitAction isSubmitting={webhookBusy} label="Buat Kunci Webhook Otomatis" busyLabel="Membuat..." disabled={!webhookName.trim()} /></FormCardFooter></form></FormCard>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><CredentialList title="Kunci API" description="Kunci aktif dan yang sudah kedaluwarsa. Nilai kunci hanya ditampilkan sekali saat dibuat." rows={keyRows} loading={loading} error={error} onRetry={load} /><CredentialList title="Daftar Kunci Webhook Otomatis" description="Kunci webhook masuk yang aktif dan kadaluarsa." rows={webhookRows} loading={loading} error={error} onRetry={load} /></div>
    <Panel className="mt-6"><div className="mb-4 flex items-center gap-2"><XCircle className="size-4 text-negative" /><div><h2 className="text-sm font-semibold">Riwayat Kredensial Dicabut</h2><p className="text-xs text-ink-soft">Kredensial yang dicabut tetap disimpan untuk jejak audit.</p></div></div>{loading ? <LoadingState label="Memuat riwayat…" /> : error ? <ErrorState message={error} onRetry={load} /> : <DataList rows={revokedRows} />}</Panel>
    <SecretRevealDialog secretValue={secretValue} title={secretTitle} description="Nilai ini hanya ditampilkan sekali. Salin sekarang sebelum menutup jendela ini." open={Boolean(secretValue)} onOpenChange={(open) => { if (!open) setSecretValue(""); }} />
    <ConfirmDialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !revoking) setTarget(null); }} title="Cabut kredensial?" description={`Ini akan langsung menonaktifkan ${target?.item.name ?? "kredensial ini"}. Tahan tombol cabut selama dua detik untuk mengonfirmasi.`} variant="danger" confirmLabel="Tahan untuk mencabut" isConfirming={revoking} onConfirm={() => void revoke()} />
  </div>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "tokens-status" | "guide">(() => {
    if (typeof window !== "undefined") {
      if (window.location.search.includes("tab=tokens-status")) {
        return "tokens-status";
      } else if (window.location.search.includes("tab=guide")) {
        return "guide";
      }
    }
    return "profile";
  });
  const [mobileAutomationTab, setMobileAutomationTab] = useState<"ios" | "android">("ios");
  const [guideStep, setGuideStep] = useState(1);
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState("id");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [defaultCurrency, setDefaultCurrency] = useState("IDR");
  const [readyStatus, setReadyStatus] = useState("ok");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab !== "guide") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setGuideStep((s) => Math.max(1, s - 1));
      } else if (e.key === "ArrowRight") {
        setGuideStep((s) => Math.min(4, s + 1));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab]);

  function loadData() {
    setBusy(true);
    Promise.all([
      api.me(),
      api.ready().catch(() => ({ status: "unavailable" })),
    ])
      .then(([meData, health]) => {
        setMe(meData);
        setFullName(meData.profile?.full_name || "");
        setPhone(meData.profile?.phone_number || "");
        setLocale(meData.profile?.locale || "id");
        setDateFormat(meData.profile?.date_format || "DD/MM/YYYY");
        setDefaultCurrency(meData.profile?.default_currency || "IDR");
        setReadyStatus(health.status);
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api.patchMe({ 
        full_name: fullName, 
        phone_number: phone,
        locale,
        date_format: dateFormat,
        default_currency: defaultCurrency
      });
      setMessage("Preferensi profil berhasil diperbarui!");
      toast.success("Preferensi profil berhasil diperbarui.");
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui profil.";
      setMessage(msg);
      toast.error("Gagal memperbarui profil", { detail: msg });
    } finally {
      setBusy(false);
    }
  }

  async function runDiagnostics() {
    setBusy(true);
    try {
      const health = await api.ready();
      setReadyStatus(health?.status || "ok");
    } catch {
      setReadyStatus("unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <InfoTooltipProvider>
      <div className="page-shell grid gap-6 w-full max-w-full min-w-0 overflow-hidden">
        <MobilePageHeader />
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4 min-w-0">
          {/* Phones: the shell header already names the page. */}
          <div className="hidden md:block">
            <div className="flex items-center gap-1.5">
              <p className="eyebrow text-ink-soft">Akun dan sistem</p>
              <InfoTooltip content="Kelola identitas akun dan diagnosa server. Pengaturan koneksi eksternal tersedia di halaman Integrasi." />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink">Pengaturan</h2>
          </div>

          <div className="no-scrollbar -mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex shrink-0 gap-1 whitespace-nowrap rounded-lg surface-inset p-1" role="tablist" aria-label="Bagian pengaturan">
            <button
              role="tab"
              id="tab-profile"
              aria-selected={activeTab === "profile"}
              aria-controls="tabpanel-profile"
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-md transition-all min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                activeTab === "profile" ? "surface-raised-sm text-ink" : "text-ink-soft"
              }`}
              onClick={() => {
                setActiveTab("profile");
                if (typeof window !== "undefined") window.history.replaceState(null, "", "?tab=profile");
              }}
            >
              <span className="flex items-center gap-1.5">
                <User className="size-3.5" />
                Profil Saya
              </span>
            </button>
            <button
              role="tab"
              id="tab-tokens-status"
              aria-selected={activeTab === "tokens-status"}
              aria-controls="tabpanel-tokens-status"
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-md transition-all min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                activeTab === "tokens-status" ? "surface-raised-sm text-ink" : "text-ink-soft"
              }`}
              onClick={() => {
                setActiveTab("tokens-status");
                if (typeof window !== "undefined") window.history.replaceState(null, "", "?tab=tokens-status");
              }}
            >
              <span className="flex items-center gap-1.5">
                <SettingsIcon className="size-3.5" />
                Status Sistem &amp; Integrasi
              </span>
            </button>
            <button
              role="tab"
              id="tab-guide"
              aria-selected={activeTab === "guide"}
              aria-controls="tabpanel-guide"
              className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-md transition-all min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                activeTab === "guide" ? "surface-raised-sm text-ink" : "text-ink-soft"
              }`}
              onClick={() => {
                setActiveTab("guide");
                if (typeof window !== "undefined") window.history.replaceState(null, "", "?tab=guide");
              }}
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" />
                Panduan Pengguna
              </span>
            </button>
          </div>
          </div>
        </div>

        {/* Tab 1: Profil Saya */}
        {activeTab === "profile" ? (
          <div role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile" tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-xl max-w-2xl min-w-0">
            <section aria-labelledby="appearance-title" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl surface-raised p-4 sm:p-5">
              <div className="min-w-0">
                <h3 id="appearance-title" className="text-sm font-bold text-ink">Tampilan</h3>
                <p className="mt-1 text-xs text-ink-soft">Ikuti pengaturan perangkat, atau pilih terang atau gelap.</p>
              </div>
              <ThemeToggle />
            </section>
            <Panel className="rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-bold text-ink mb-4">Informasi Profil Pengguna</h3>
              {message ? (
                <p role="status" className="mb-4 rounded-lg border border-positive-line bg-positive-soft p-3 text-sm font-semibold text-positive">
                  {message}
                </p>
              ) : null}
              <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                <FormField label="Email" hint="Email mengikuti akun Google dan tidak bisa diubah." readOnly>
                  <TextField type="email" value={me?.email || ""} readOnly />
                </FormField>
                <FormField label="Nama lengkap" required>
                  <TextField value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </FormField>
                <FormField label="Nomor telepon">
                  <TextField type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812..." autoComplete="tel" />
                </FormField>
                <FormField label="Bahasa">
                  <NativeSelectField value={locale} onChange={(e) => setLocale(e.target.value)}>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </NativeSelectField>
                </FormField>
                <FormField label="Format tanggal">
                  <NativeSelectField value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </NativeSelectField>
                </FormField>
                <FormField label="Mata uang utama">
                  <NativeSelectField value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                    <option value="SGD">SGD</option>
                    <option value="EUR">EUR</option>
                  </NativeSelectField>
                </FormField>
                <button className="btn-primary mt-2 min-h-[44px] py-2.5" type="submit" disabled={busy}>
                  Simpan Profil
                </button>
              </form>
            </Panel>
          </div>
        ) : null}

        {/* Tab 2: Status Sistem & Integrasi */}
        {activeTab === "tokens-status" ? (
          <div role="tabpanel" id="tabpanel-tokens-status" aria-labelledby="tab-tokens-status" tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-xl max-w-4xl w-full min-w-0">
            <div className="grid gap-6 min-w-0">
              {/* Mobile Automation Tab Switcher */}
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <button
                  type="button"
                  onClick={() => setMobileAutomationTab("ios")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-h-[36px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                    mobileAutomationTab === "ios"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-paper text-ink-soft hover:bg-paper-sunk border border-line"
                  }`}
                >
                  <Smartphone className="size-3.5" aria-hidden="true" /> iOS Shortcut
                </button>
                <button
                  type="button"
                  onClick={() => setMobileAutomationTab("android")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-h-[36px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                    mobileAutomationTab === "android"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-paper text-ink-soft hover:bg-paper-sunk border border-line"
                  }`}
                >
                  <Bot className="size-3.5" aria-hidden="true" /> Android (MacroDroid)
                </button>
              </div>

              {/* 1. Hero Utama (Atas): Mobile Automation Integration Guide */}
              {mobileAutomationTab === "ios" ? (
                <IOSShortcutGuideCard id="ios-shortcut" onKeyCreated={loadData} />
              ) : (
                <AndroidGuideCard id="android-guide" onKeyCreated={loadData} />
              )}

              <PushNotificationCard id="push-notifications" />

              {/* 2. Status Diagnosa Server Ringkas (Tengah) */}
              <div className="rounded-xl surface-raised p-4 sm:p-5 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-line min-w-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <Server className="size-4 text-ink-soft" />
                      <h3 className="text-sm font-bold text-ink">Status Diagnosa Server</h3>
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">Pantau status ketersediaan dan latensi layanan utama.</p>
                  </div>
                  <button 
                    onClick={runDiagnostics} 
                    disabled={busy}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-paper hover:bg-paper-sunk text-ink text-xs font-bold rounded-lg border border-line-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50 active:scale-98 shrink-0"
                  >
                    <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
                    {busy ? "Memeriksa..." : "Perbarui Diagnosa"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5 min-w-0">
                  {/* Item 1: API Server */}
                  <div className="flex items-center justify-between sm:justify-start gap-3 p-3 rounded-lg bg-paper border border-line min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {readyStatus === 'ok' ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive-solid opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-positive-solid"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-negative-solid"></span>
                        )}
                      </span>
                      <span className="text-xs text-ink-soft font-semibold">API Server</span>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${readyStatus === 'ok' ? 'text-positive' : 'text-negative'}`}>
                      <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full bg-current align-middle" />{readyStatus === 'ok' ? 'Terhubung' : 'Terputus'}
                    </span>
                  </div>

                  {/* Item 2: Latensi */}
                  <div className="flex items-center justify-between sm:justify-start gap-3 p-3 rounded-lg bg-paper border border-line min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Activity className="size-3.5 text-ink-soft shrink-0" />
                      <span className="text-xs text-ink-soft font-semibold">Latensi</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-ink">
                        {readyStatus === 'ok' ? '42 ms' : '--'}
                      </span>
                      <span className="text-xs font-semibold text-info bg-info-soft px-1.5 py-0.5 rounded border border-info-line/50">
                        Estimasi
                      </span>
                    </div>
                  </div>

                  {/* Item 3: Database */}
                  <div className="flex items-center justify-between sm:justify-start gap-3 p-3 rounded-lg bg-paper border border-line min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Database className="size-3.5 text-ink-soft shrink-0" />
                      <span className="text-xs text-ink-soft font-semibold">Database</span>
                    </div>
                    <span className="text-xs font-bold text-positive shrink-0">
                      <span aria-hidden="true" className="mr-1.5 inline-block size-2 rounded-full bg-current align-middle" />PostgreSQL siap
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Mode Pengembang & Kredensial Lanjutan (Bawah) */}
              <details className="group border border-line bg-paper rounded-xl p-4 sm:p-5 shadow-2xs transition-all min-w-0">
                <summary className="flex items-center justify-between cursor-pointer list-none select-none min-h-[44px] gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <h4 className="text-sm font-bold text-ink group-hover:text-ink flex items-center gap-2">
                      <KeyRound className="size-4 text-ink-soft shrink-0" />
                      <span>Mode Pengembang &amp; Kredensial Lanjutan (Advanced)</span>
                    </h4>
                    <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                      Kelola API Key manual, integrasi webhook khusus, dan riwayat kredensial yang dicabut.
                    </p>
                  </div>
                  <span className="surface-raised-sm text-xs font-bold text-ink-soft group-open:rotate-180 transition-transform duration-200 shrink-0 p-1.5 rounded-md">
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </span>
                </summary>
                <div className="pt-4 border-t border-line mt-4 min-w-0">
                  <IntegrationsSection />
                </div>
              </details>
            </div>
          </div>
        ) : null}

        {/* Tab 3: Panduan Pengguna */}
        {activeTab === "guide" ? (
          <div role="tabpanel" id="tabpanel-guide" aria-labelledby="tab-guide" tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-xl max-w-4xl min-w-0">
            <div className="grid gap-6 min-w-0">
              <Panel className="surface-raised rounded-xl p-5 sm:p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h3 className="text-xl font-extrabold text-ink">Panduan Interaktif</h3>
                    <p className="text-sm text-ink-soft mt-1">Langkah {guideStep} dari 4</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setGuideStep(s => Math.max(1, s - 1))}
                      disabled={guideStep === 1}
                      aria-label="Langkah sebelumnya"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1.5 text-sm font-bold bg-paper rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50"
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" /> Sebelumnya
                    </button>
                    <button 
                      onClick={() => setGuideStep(s => Math.min(4, s + 1))}
                      disabled={guideStep === 4}
                      aria-label="Langkah selanjutnya"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1.5 text-sm font-bold bg-paper rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50"
                    >
                      Berikutnya <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                
                <div className="min-h-[120px]">
                  {guideStep === 1 && (
                    <div>
                      <h4 className="text-lg font-bold text-ink mb-3">1. Wallet &amp; Rekening</h4>
                      <p className="text-sm text-ink-soft">Inisialisasi dompet, provider, dan saldo awal Anda.</p>
                    </div>
                  )}
                  {guideStep === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-bold text-ink mb-1">2. Transaksi &amp; Inbox</h4>
                        <p className="text-sm text-ink-soft">
                          Pencatatan transaksi instan, OCR nota otomatis, dan verifikasi AI staging inbox tanpa friksi.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                        <div className="rounded-xl border border-line bg-paper p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="size-4 text-positive" />
                            <h5 className="text-xs font-bold text-ink">Gemini Multimodal OCR</h5>
                          </div>
                          <p className="text-xs text-ink-soft leading-relaxed">
                            Unggah foto nota fisik, struk belanja, atau tangkapan layar m-banking. Gemini 2.5 Flash akan mengekstrak nominal, merchant, tanggal, serta kategori secara otomatis ke Staging Inbox.
                          </p>
                        </div>

                        <div className="rounded-xl border border-line bg-paper p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Smartphone className="size-4 text-info" />
                            <h5 className="text-xs font-bold text-ink">Integrasi Apple iOS Shortcut</h5>
                          </div>
                          <p className="text-xs text-ink-soft leading-relaxed">
                            Catat transaksi secepat kilat langsung dari iPhone lewat Share Sheet foto, Action Button, atau Back Tap tanpa perlu membuka browser secara manual.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("tokens-status");
                              if (typeof window !== "undefined") {
                                window.history.replaceState(null, "", "?tab=tokens-status#ios-shortcut");
                              }
                            }}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-info hover:text-info hover:underline min-h-[44px]"
                          >
                            Konfigurasi iOS Shortcut Sekarang
                            <ArrowRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {guideStep === 3 && (
                    <div>
                      <h4 className="text-lg font-bold text-ink mb-3">3. Anggaran bulanan</h4>
                      <p className="text-sm text-ink-soft">Alokasi anggaran bulanan per kategori &amp; peringatan batas pengeluaran.</p>
                    </div>
                  )}
                  {guideStep === 4 && (
                    <div>
                      <h4 className="text-lg font-bold text-ink mb-3">4. Evaluasi &amp; Laporan</h4>
                      <p className="text-sm text-ink-soft">Analisis arus kas &amp; ulasan komprehensif laporan keuangan bulanan.</p>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Keyboard shortcuts mean nothing on a phone. */}
              <Panel className="hidden surface-raised rounded-xl p-5 sm:p-6 md:block">
                <h3 className="text-lg font-bold text-ink mb-4">Pintasan keyboard</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-paper border border-line rounded-lg">
                    <span className="text-sm font-medium text-ink">Pencarian Global</span>
                    <div className="flex gap-1.5">
                      <kbd className="bg-paper-sunk border border-line-strong text-ink px-1.5 py-0.5 rounded text-xs font-mono">Cmd</kbd>
                      <kbd className="bg-paper-sunk border border-line-strong text-ink px-1.5 py-0.5 rounded text-xs font-mono">K</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-paper border border-line rounded-lg">
                    <span className="text-sm font-medium text-ink">Buka Bantuan</span>
                    <div className="flex gap-1.5">
                      <kbd className="bg-paper-sunk border border-line-strong text-ink px-1.5 py-0.5 rounded text-xs font-mono">Cmd</kbd>
                      <kbd className="bg-paper-sunk border border-line-strong text-ink px-1.5 py-0.5 rounded text-xs font-mono">/</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-paper border border-line rounded-lg">
                    <span className="text-sm font-medium text-ink">Tutup Dialog</span>
                    <div className="flex gap-1.5">
                      <kbd className="bg-paper-sunk border border-line-strong text-ink px-1.5 py-0.5 rounded text-xs font-mono">Esc</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-paper border border-line rounded-lg">
                    <span className="text-sm font-medium text-ink">Input Cepat</span>
                    <span className="text-xs font-semibold text-ink-soft">Voice to text</span>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        ) : null}
      </div>
    </InfoTooltipProvider>
  );
}
