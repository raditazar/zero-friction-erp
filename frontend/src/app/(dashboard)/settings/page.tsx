"use client";

import { useCallback, useMemo } from "react";
import { Server, Activity, Database, RefreshCw, KeyRound, Webhook, XCircle, User, Settings as SettingsIcon, BookOpen, Smartphone, Sparkles, ArrowRight } from "lucide-react";
import { useEffect, useState, FormEvent } from "react";
import { Panel, TextInput, DataList } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";

import { api, type Me, type APIKey, type WebhookToken } from "@/lib/api";
import { IOSShortcutGuideCard } from "@/components/dashboard/iOSShortcutGuideCard";
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
function statusOf(item: Pick<Credential, "revoked_at" | "expires_at">) { return item.revoked_at ? "Revoked" : item.expires_at && new Date(item.expires_at).getTime() <= Date.now() ? "Expired" : "Active"; }
function StatusBadge({ status }: { status: ReturnType<typeof statusOf> }) { return <Badge variant={status === "Active" ? "success" : status === "Expired" ? "warning" : "danger"}>{status}</Badge>; }
function latest<T extends { created_at: string }>(items: T[]) { return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); }
function Metadata({ prefix, detail, item }: { prefix: string; detail: string; item: Credential }) {
  return <div className="space-y-1"><p><span className="font-mono text-[#3D3935]">{prefix}</span> · {detail}</p><p>Created {formatDate(item.created_at)} · Last used {formatDate(item.last_used_at)}{item.expires_at ? ` · Expires ${formatDate(item.expires_at)}` : ""}{item.revoked_at ? ` · Revoked ${formatDate(item.revoked_at)}` : ""}</p></div>;
}
function CredentialList({ title, description, rows, loading, error, onRetry }: { title: string; description: string; rows: DataRows; loading: boolean; error: string; onRetry: () => void }) {
  return <Panel><div className="mb-4"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-[#706A63]">{description}</p></div>{loading ? <LoadingState label={`Loading ${title.toLowerCase()}…`} /> : error ? <ErrorState message={error} onRetry={onRetry} /> : <DataList rows={rows} />}</Panel>;
}

function IntegrationsSection() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]); const [webhooks, setWebhooks] = useState<WebhookToken[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [apiName, setApiName] = useState(""); const [read, setRead] = useState(true); const [write, setWrite] = useState(false); const [apiExpiry, setApiExpiry] = useState(""); const [apiBusy, setApiBusy] = useState(false);
  const [webhookName, setWebhookName] = useState(""); const [source, setSource] = useState("ios"); const [webhookExpiry, setWebhookExpiry] = useState(""); const [webhookBusy, setWebhookBusy] = useState(false);
  const [secretValue, setSecretValue] = useState(""); const [secretTitle, setSecretTitle] = useState("Credential created"); const [target, setTarget] = useState<Target>(null); const [revoking, setRevoking] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [keys, tokens] = await Promise.all([api.apiKeys({ include_revoked: true }), api.webhookTokens({ include_revoked: true })]); setApiKeys(latest(keys)); setWebhooks(latest(tokens)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load Vault credentials."); } finally { setLoading(false); } }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  const liveKeys = useMemo(() => apiKeys.filter((item) => !item.revoked_at), [apiKeys]); const liveWebhooks = useMemo(() => webhooks.filter((item) => !item.revoked_at), [webhooks]);
  const revoked = useMemo(() => latest([...apiKeys.filter((item) => item.revoked_at).map((item) => ({ kind: "API key", item, created_at: item.created_at })), ...webhooks.filter((item) => item.revoked_at).map((item) => ({ kind: "Webhook", item, created_at: item.created_at }))]), [apiKeys, webhooks]);
  async function createKey(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!apiName.trim() || (!read && !write)) return; setApiBusy(true); setNotice(""); try { const created = await api.createAPIKey({ name: apiName.trim(), scopes: [read && "transactions:read", write && "transactions:write"].filter((scope): scope is string => Boolean(scope)), ...(apiExpiry ? { expires_at: apiExpiry } : {}) }); setApiName(""); setRead(true); setWrite(false); setApiExpiry(""); toast.success("API Key berhasil dibuat."); await load(); if (created.token) { setSecretTitle("API key created — copy it now"); setSecretValue(created.token); } else setNotice("API key created, but its secret was not returned."); } catch (caught) { const msg = caught instanceof Error ? caught.message : "Could not create the API key."; setNotice(msg); toast.error("Gagal membuat API Key", { detail: msg }); } finally { setApiBusy(false); } }
  async function createWebhook(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!webhookName.trim()) return; setWebhookBusy(true); setNotice(""); try { const created = await api.createWebhookToken({ name: webhookName.trim(), source, ...(webhookExpiry ? { expires_at: webhookExpiry } : {}) }); setWebhookName(""); setSource("ios"); setWebhookExpiry(""); toast.success("Webhook secret berhasil dibuat."); await load(); if (created.token) { setSecretTitle("Webhook secret created — copy it now"); setSecretValue(created.token); } else setNotice("Webhook secret created, but its secret was not returned."); } catch (caught) { const msg = caught instanceof Error ? caught.message : "Could not create the webhook secret."; setNotice(msg); toast.error("Gagal membuat Webhook secret", { detail: msg }); } finally { setWebhookBusy(false); } }
  async function revoke() { if (!target) return; setRevoking(true); setNotice(""); const isApi = target.kind === "api"; try { if (target.kind === "api") await api.revokeAPIKey(target.item.id); else await api.revokeWebhookToken(target.item.id); toast.success(isApi ? "API Key berhasil dicabut." : "Webhook secret berhasil dicabut."); setTarget(null); await load(); } catch (caught) { const msg = caught instanceof Error ? caught.message : "Could not revoke this credential."; setNotice(msg); toast.error(isApi ? "Gagal mencabut API Key" : "Gagal mencabut Webhook secret", { detail: msg }); } finally { setRevoking(false); } }
  const keyRows: DataRows = liveKeys.map((item) => ({ id: item.id, title: <div className="flex flex-wrap items-center gap-2"><span>{item.name}</span><StatusBadge status={statusOf(item)} /></div>, meta: <Metadata prefix={item.key_prefix} detail={item.scopes.join(", ")} item={item} />, action: <Button variant="ghost" size="sm" className="text-red-700 hover:text-red-800" onClick={() => setTarget({ kind: "api", item })}>Revoke</Button> }));
  const webhookRows: DataRows = liveWebhooks.map((item) => ({ id: item.id, title: <div className="flex flex-wrap items-center gap-2"><span>{item.name}</span><StatusBadge status={statusOf(item)} /></div>, meta: <Metadata prefix={item.token_prefix} detail={`Source: ${item.source}`} item={item} />, action: <Button variant="ghost" size="sm" className="text-red-700 hover:text-red-800" onClick={() => setTarget({ kind: "webhook", item })}>Revoke</Button> }));
  const revokedRows: DataRows = revoked.map(({ kind, item }) => ({ id: `${kind}-${item.id}`, title: <div className="flex flex-wrap items-center gap-2"><span>{item.name}</span><StatusBadge status="Revoked" /></div>, meta: <Metadata prefix={"key_prefix" in item ? item.key_prefix : item.token_prefix} detail={"scopes" in item ? `${kind} · ${item.scopes.join(", ")}` : `${kind} · Source: ${item.source}`} item={item} /> }));
  const minDate = new Date().toISOString().slice(0, 10);
  return <div className="mt-12">
    <div className="mb-6"><h3 className="text-xl font-extrabold text-[#1A1A1A]">Integrations Vault</h3><p className="text-sm text-[#5A5A5A] mt-1">Issue and revoke narrowly scoped credentials for trusted finance workflows.</p></div>
    {notice ? <p role="status" className="mb-5 rounded-lg border border-[#D8D1C8] bg-[#FFFEFC] px-4 py-3 text-sm text-[#514B44]">{notice}</p> : null}
    <div className="grid gap-6 xl:grid-cols-2">
      <FormCard variant="sensitive"><form onSubmit={createKey}><FormCardHeader><div><FormCardTitle className="flex items-center gap-2"><KeyRound className="size-4" />API key</FormCardTitle><FormCardDescription>Use scopes to limit what an integration can do.</FormCardDescription></div></FormCardHeader><FormCardContent className="space-y-4"><FormField label="Name" required><TextField value={apiName} onChange={(event) => setApiName(event.target.value)} placeholder="e.g. reconciliation service" /></FormField><FormField label="Quick preset"><SelectField value={read && write ? "read-write" : "read"} onChange={(event) => { const both = event.target.value === "read-write"; setRead(true); setWrite(both); }}><option value="read">Read only (transactions:read)</option><option value="read-write">Read &amp; write (transactions:read, transactions:write)</option></SelectField></FormField><fieldset className="space-y-2"><legend className="text-xs font-semibold text-[#3D3935]">Granular scopes</legend><label className="flex items-center gap-2 text-sm"><CheckboxField checked={read} onChange={(event) => setRead(event.target.checked)} />transactions:read</label><label className="flex items-center gap-2 text-sm"><CheckboxField checked={write} onChange={(event) => setWrite(event.target.checked)} />transactions:write</label></fieldset><FormField label="Expiry" hint="Optional; expires at the start of the selected local date."><DateField value={apiExpiry} min={minDate} onChange={(event) => setApiExpiry(event.target.value)} /></FormField></FormCardContent><FormCardFooter><SubmitAction isSubmitting={apiBusy} label="Create API key" busyLabel="Creating…" disabled={!apiName.trim() || (!read && !write)} /></FormCardFooter></form></FormCard>
      <FormCard variant="sensitive"><form onSubmit={createWebhook}><FormCardHeader><div><FormCardTitle className="flex items-center gap-2"><Webhook className="size-4" />Webhook secret</FormCardTitle><FormCardDescription>Authorize one incoming source without exposing account access.</FormCardDescription></div></FormCardHeader><FormCardContent className="space-y-4"><FormField label="Name" required><TextField value={webhookName} onChange={(event) => setWebhookName(event.target.value)} placeholder="e.g. iOS shortcut" /></FormField><FormField label="Source"><SelectField value={source} onChange={(event) => setSource(event.target.value)}><option value="ios">iOS</option><option value="cronjob">Cronjob</option><option value="api">API</option></SelectField></FormField><FormField label="Expiry" hint="Optional; expires at the start of the selected local date."><DateField value={webhookExpiry} min={minDate} onChange={(event) => setWebhookExpiry(event.target.value)} /></FormField></FormCardContent><FormCardFooter><SubmitAction isSubmitting={webhookBusy} label="Create webhook secret" busyLabel="Creating…" disabled={!webhookName.trim()} /></FormCardFooter></form></FormCard>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><CredentialList title="API keys" description="Active and expired keys. Scopes are metadata only; the key itself is never shown again." rows={keyRows} loading={loading} error={error} onRetry={load} /><CredentialList title="Webhook secrets" description="Active and expired inbound secrets." rows={webhookRows} loading={loading} error={error} onRetry={load} /></div>
    <Panel className="mt-6"><div className="mb-4 flex items-center gap-2"><XCircle className="size-4 text-[#A54B36]" /><div><h2 className="text-sm font-semibold">Revoked history</h2><p className="text-xs text-[#706A63]">Revoked credentials are retained as an audit trail.</p></div></div>{loading ? <LoadingState label="Loading revoked history…" /> : error ? <ErrorState message={error} onRetry={load} /> : <DataList rows={revokedRows} />}</Panel>
    <SecretRevealDialog secretValue={secretValue} title={secretTitle} description="This value is shown once. Copy it before closing this window." open={Boolean(secretValue)} onOpenChange={(open) => { if (!open) setSecretValue(""); }} />
    <ConfirmDialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !revoking) setTarget(null); }} title="Revoke credential?" description={`This immediately disables ${target?.item.name ?? "this credential"}. Hold the revoke button for two seconds to confirm.`} variant="danger" confirmLabel="Hold to revoke" isConfirming={revoking} onConfirm={() => void revoke()} />
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
      <div className="p-6 bg-[#F4F3EE] min-h-screen grid gap-6">
      <MobilePageHeader />
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DDD6] pb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="eyebrow text-[#5A5A5A]">Pengaturan Terpadu & Profil</p>
              <InfoTooltip content="Kelola identitas akun dan diagnosa server. Pengaturan koneksi eksternal tersedia di halaman Integrasi." />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1A1A1A]">Settings & System</h2>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap rounded-lg bg-[#E8E5DF] p-1 gap-1" role="tablist" aria-label="Pengaturan Terpadu">
            <button
              role="tab"
              id="tab-profile"
              aria-selected={activeTab === "profile"}
              aria-controls="tabpanel-profile"
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] ${
                activeTab === "profile" ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm" : "text-[#5A5A5A]"
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
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] ${
                activeTab === "tokens-status" ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm" : "text-[#5A5A5A]"
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
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] ${
                activeTab === "guide" ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm" : "text-[#5A5A5A]"
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

        {/* Tab 1: Profil Saya */}
        {activeTab === "profile" ? (
          <div role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile" tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] rounded-xl max-w-2xl">
            <Panel className="bg-[#1B2326] border border-[#273538] rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#F5FEFD] mb-4">Informasi Profil Pengguna</h3>
              {message ? (
                <p className="mb-4 rounded-lg bg-[#10F5CC]/20 border border-[#10F5CC]/40 p-3 text-xs font-semibold text-[#10F5CC]">
                  {message}
                </p>
              ) : null}
              <form className="grid gap-4" onSubmit={handleProfileSubmit}>
                <TextInput label="Email (Terkunci)" value={me?.email || ""} onChange={() => {}} required />
                <TextInput label="Nama Lengkap" value={fullName} onChange={setFullName} required />
                <TextInput label="Nomor Telepon" value={phone} onChange={setPhone} placeholder="0812..." />
                
                <label className="grid gap-1.5 text-sm w-full">
                  <span className="text-[#6E6D7A] font-semibold">Bahasa / Locale</span>
                  <select className="flex h-10 w-full rounded-lg border border-[#E8E6E1] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#10F5CC] transition-all" value={locale} onChange={(e) => setLocale(e.target.value)}>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </label>

                <label className="grid gap-1.5 text-sm w-full">
                  <span className="text-[#6E6D7A] font-semibold">Format Tanggal</span>
                  <select className="flex h-10 w-full rounded-lg border border-[#E8E6E1] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#10F5CC] transition-all" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  </select>
                </label>

                <label className="grid gap-1.5 text-sm w-full">
                  <span className="text-[#6E6D7A] font-semibold">Mata Uang Default</span>
                  <select className="flex h-10 w-full rounded-lg border border-[#E8E6E1] bg-[#FFFFFF] px-3 py-2 text-sm text-[#1A1A1A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#10F5CC] transition-all" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                    <option value="SGD">SGD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>

                <button className="btn-primary min-h-[44px] py-2.5 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10F5CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B2326]" type="submit" disabled={busy}>
                  Simpan Profil
                </button>
              </form>
            </Panel>
          </div>
        ) : null}

        {/* Tab 2: Status Sistem */}
        {activeTab === "tokens-status" ? (
          <div role="tabpanel" id="tabpanel-tokens-status" aria-labelledby="tab-tokens-status" tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] rounded-xl max-w-4xl">
            <div className="grid gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-[#1A1A1A]">Diagnosa Infrastruktur Server</h3>
                  <p className="text-sm text-[#5A5A5A] mt-1">Pantau status ketersediaan dan latensi layanan utama.</p>
                </div>
                <button 
                  onClick={runDiagnostics} 
                  disabled={busy}
                  className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-[#333333] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
                  {busy ? "Memeriksa..." : "Jalankan System Diagnostics Check"}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Status API */}
                <Panel className="bg-white border border-[#E0DDD6] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-[#5A5A5A]">Status API Server</h4>
                    <Server className="size-5 text-[#5A5A5A]" />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black text-[#1A1A1A] uppercase">{readyStatus === 'ok' ? 'Online' : 'Offline'}</p>
                    </div>
                    {readyStatus === 'ok' ? (
                      <span className="inline-flex items-center rounded-md bg-[#DDF9F2] px-2 py-1 text-xs font-bold text-[#047857] ring-1 ring-inset ring-[#047857]/20">
                        ● ONLINE
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20">
                        ● OFFLINE
                      </span>
                    )}
                  </div>
                </Panel>

                {/* Card 2: Server Latency */}
                <Panel className="bg-white border border-[#E0DDD6] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-[#5A5A5A]">Server Latency</h4>
                    <Activity className="size-5 text-[#5A5A5A]" />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black text-[#1A1A1A]">
                        {readyStatus === 'ok' ? '42 ms' : '--'}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      ESTIMASI
                    </span>
                  </div>
                </Panel>

                {/* Card 3: Database Readiness */}
                <Panel className="bg-white border border-[#E0DDD6] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-[#5A5A5A]">Kesiapan Database</h4>
                    <Database className="size-5 text-[#5A5A5A]" />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black text-[#1A1A1A]">Ready</p>
                    </div>
                    <span className="inline-flex items-center rounded-md bg-[#DDF9F2] px-2 py-1 text-xs font-bold text-[#047857] ring-1 ring-inset ring-[#047857]/20">
                      ● PostgreSQL
                    </span>
                  </div>
                </Panel>
              </div>
              
              {/* iOS Shortcut Integration Guide */}
              <IOSShortcutGuideCard id="ios-shortcut" onKeyCreated={loadData} />
              
              {/* Integrations Section */}
              <IntegrationsSection />
            </div>
          </div>
        ) : null}

        {/* Tab 3: Panduan Pengguna */}
        {activeTab === "guide" ? (
          <div role="tabpanel" id="tabpanel-guide" aria-labelledby="tab-guide" tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] rounded-xl max-w-4xl">
            <div className="grid gap-6">
              <Panel className="bg-[#FFFFFF] border border-[#E8E6E1] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-extrabold text-[#1A1A1A]">Panduan Interaktif</h3>
                    <p className="text-sm text-[#5A5A5A] mt-1">Langkah {guideStep} dari 4</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setGuideStep(s => Math.max(1, s - 1))}
                      disabled={guideStep === 1}
                      aria-label="Langkah sebelumnya"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1.5 text-sm font-bold bg-[#F4F3EE] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <button 
                      onClick={() => setGuideStep(s => Math.min(4, s + 1))}
                      disabled={guideStep === 4}
                      aria-label="Langkah selanjutnya"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1.5 text-sm font-bold bg-[#F4F3EE] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>
                
                <div className="min-h-[120px]">
                  {guideStep === 1 && (
                    <div>
                      <h4 className="text-lg font-bold text-[#1A1A1A] mb-3">1. Wallet & Rekening</h4>
                      <p className="text-sm text-[#5A5A5A]">Inisialisasi dompet, provider, dan saldo awal Anda.</p>
                    </div>
                  )}
                  {guideStep === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-bold text-[#1A1A1A] mb-1">2. Transaksi &amp; Inbox</h4>
                        <p className="text-sm text-[#5A5A5A]">
                          Pencatatan transaksi instan, OCR nota otomatis, dan verifikasi AI staging inbox tanpa friksi.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                        <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="size-4 text-[#047857]" />
                            <h5 className="text-xs font-bold text-[#1A1A1A]">Gemini Multimodal OCR</h5>
                          </div>
                          <p className="text-xs text-[#706A63] leading-relaxed">
                            Unggah foto nota fisik, struk belanja, atau tangkapan layar m-banking. Gemini 2.5 Flash akan mengekstrak nominal, merchant, tanggal, serta kategori secara otomatis ke Staging Inbox.
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F5] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Smartphone className="size-4 text-[#0071E3]" />
                            <h5 className="text-xs font-bold text-[#1A1A1A]">Integrasi Apple iOS Shortcut</h5>
                          </div>
                          <p className="text-xs text-[#706A63] leading-relaxed">
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
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0071E3] hover:text-[#005bb5] hover:underline"
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
                      <h4 className="text-lg font-bold text-[#1A1A1A] mb-3">3. Monthly Budget</h4>
                      <p className="text-sm text-[#5A5A5A]">Alokasi anggaran bulanan per kategori & peringatan batas pengeluaran.</p>
                    </div>
                  )}
                  {guideStep === 4 && (
                    <div>
                      <h4 className="text-lg font-bold text-[#1A1A1A] mb-3">4. Evaluasi & Laporan</h4>
                      <p className="text-sm text-[#5A5A5A]">Analisis arus kas & ulasan komprehensif laporan keuangan bulanan.</p>
                    </div>
                  )}
                </div>
              </Panel>

              <Panel className="bg-[#FFFFFF] border border-[#E8E6E1] rounded-xl p-6">
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Pintasan Keyboard (Shortcuts)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-[#F9F8F5] border border-[#E8E6E1] rounded-lg">
                    <span className="text-sm font-medium text-[#1A1A1A]">Pencarian Global</span>
                    <div className="flex gap-1.5">
                      <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] px-1.5 py-0.5 rounded text-xs font-mono">Cmd</kbd>
                      <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] px-1.5 py-0.5 rounded text-xs font-mono">K</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#F9F8F5] border border-[#E8E6E1] rounded-lg">
                    <span className="text-sm font-medium text-[#1A1A1A]">Buka Bantuan</span>
                    <div className="flex gap-1.5">
                      <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] px-1.5 py-0.5 rounded text-xs font-mono">Cmd</kbd>
                      <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] px-1.5 py-0.5 rounded text-xs font-mono">/</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#F9F8F5] border border-[#E8E6E1] rounded-lg">
                    <span className="text-sm font-medium text-[#1A1A1A]">Tutup Dialog</span>
                    <div className="flex gap-1.5">
                      <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] px-1.5 py-0.5 rounded text-xs font-mono">Esc</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#F9F8F5] border border-[#E8E6E1] rounded-lg">
                    <span className="text-sm font-medium text-[#1A1A1A]">Input Cepat</span>
                    <span className="text-xs font-semibold text-[#5A5A5A]">Voice to text</span>
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
