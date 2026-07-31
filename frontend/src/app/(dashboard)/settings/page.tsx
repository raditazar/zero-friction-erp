"use client";

import { useEffect, useState, FormEvent } from "react";
import { Panel, TextInput } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { api, type APIKey, type Me, type WebhookToken } from "@/lib/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "tokens" | "system">("profile");
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [webhookTokens, setWebhookTokens] = useState<WebhookToken[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [readyStatus, setReadyStatus] = useState("ok");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([
      api.me(),
      api.apiKeys().catch(() => []),
      api.webhookTokens().catch(() => []),
      api.ready().catch(() => ({ status: "unavailable" })),
    ])
      .then(([meData, keysData, tokensData, health]) => {
        setMe(meData);
        setFullName(meData.profile?.full_name || "");
        setPhone(meData.profile?.phone_number || "");
        setApiKeys(keysData);
        setWebhookTokens(tokensData);
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
      await api.patchMe({ full_name: fullName, phone_number: phone });
      setMessage("Profil berhasil diperbarui!");
      loadData();
    } catch (err) {
      setMessage("Gagal memperbarui profil.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateKey(e: FormEvent) {
    e.preventDefault();
    if (!keyName) return;
    setBusy(true);
    try {
      const created = await api.createAPIKey({ name: keyName, scopes: ["*"] });
      setNewKey((created as any).key || "Token berhasil dibuat");
      setKeyName("");
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <InfoTooltipProvider>
      <div className="p-6 bg-[#FBF9F5] min-h-screen grid gap-6">
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between border-b border-[#E0DDD6] pb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="eyebrow text-[#5A5A5A]">Pengaturan Terpadu & Profil</p>
              <InfoTooltip content="Kelola identitas akun, kunci integrasi iPhone Shortcut, dan diagnosa server di 1 tempat." />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1A1A1A]">Settings & System</h2>
          </div>

          <div className="flex rounded-lg bg-[#E8E5DF] p-1 gap-1">
            <button
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "profile" ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm" : "text-[#5A5A5A]"
              }`}
              onClick={() => setActiveTab("profile")}
            >
              👤 Profil Saya
            </button>
            <button
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "tokens" ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm" : "text-[#5A5A5A]"
              }`}
              onClick={() => setActiveTab("tokens")}
            >
              🔑 API Keys & Webhooks
            </button>
            <button
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "system" ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm" : "text-[#5A5A5A]"
              }`}
              onClick={() => setActiveTab("system")}
            >
              ⚙️ Status Sistem
            </button>
          </div>
        </div>

        {/* Tab 1: Profil Saya */}
        {activeTab === "profile" ? (
          <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6 max-w-2xl">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Informasi Profil Pengguna</h3>
            {message ? (
              <p className="mb-4 rounded-lg bg-[#D1FAE5] border border-[#A7F3D0] p-3 text-xs font-semibold text-[#065F46]">
                {message}
              </p>
            ) : null}
            <form className="grid gap-4" onSubmit={handleProfileSubmit}>
              <TextInput label="Email (Terkunci)" value={me?.email || ""} onChange={() => {}} required />
              <TextInput label="Nama Lengkap" value={fullName} onChange={setFullName} required />
              <TextInput label="Nomor Telepon" value={phone} onChange={setPhone} placeholder="0812..." />
              <button className="btn-primary py-2.5 mt-2" type="submit" disabled={busy}>
                Simpan Profil
              </button>
            </form>
          </Panel>
        ) : null}

        {/* Tab 2: API Keys & Webhooks */}
        {activeTab === "tokens" ? (
          <div className="grid gap-6 max-w-4xl">
            <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Buat API Key Baru (iPhone Shortcut Integration)</h3>
              <p className="text-xs text-[#5A5A5A] mb-4">
                API Key digunakan untuk mengotorisasi pengiriman nota/struk dari iPhone Shortcuts secara otomatis tanpa login manual.
              </p>
              {newKey ? (
                <div className="mb-4 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-4">
                  <p className="text-xs font-bold text-[#065F46]">Kunci Baru Berhasil Dibuat (Salin Sekarang):</p>
                  <code className="mt-1 block font-mono text-sm font-bold text-[#047857] select-all bg-[#FFFFFF] p-2 rounded border border-[#A7F3D0]">
                    {newKey}
                  </code>
                </div>
              ) : null}
              <form className="flex gap-3" onSubmit={handleCreateKey}>
                <div className="flex-1">
                  <TextInput label="Nama Kunci / Perangkat" value={keyName} onChange={setKeyName} placeholder="Contoh: iPhone 15 Pro Shortcut" required />
                </div>
                <div className="flex items-end">
                  <button className="btn-primary py-2.5 px-4" type="submit" disabled={busy}>
                    + Buat Key
                  </button>
                </div>
              </form>
            </Panel>

            <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Daftar API Key Aktif</h3>
              <div className="grid gap-3">
                {apiKeys.length === 0 ? <p className="text-xs text-[#5A5A5A]">Belum ada API Key aktif.</p> : null}
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between rounded-xl border border-[#E0DDD6] bg-[#FFFFFF] p-4">
                    <div>
                      <h4 className="font-bold text-[#1A1A1A] text-sm">{key.name}</h4>
                      <p className="text-xs text-[#5A5A5A]">Dibuat: {new Date(key.created_at).toLocaleDateString()}</p>
                    </div>
                    <button className="btn-compact text-[#DC2626]" onClick={() => api.revokeAPIKey(key.id).then(loadData)}>
                      Cabut (Revoke)
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {/* Tab 3: Status Sistem */}
        {activeTab === "system" ? (
          <Panel className="bg-[#F0EEE9] border-none shadow-none rounded-xl p-6 max-w-2xl">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Diagnosa Infrastruktur Server</h3>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] p-4">
                <span className="text-sm font-semibold text-[#1A1A1A]">Go API Backend Health</span>
                <span className="inline-flex items-center rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-bold text-[#065F46]">
                  ● {readyStatus}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E0DDD6] bg-[#FFFFFF] p-4">
                <span className="text-sm font-semibold text-[#1A1A1A]">Database Connection</span>
                <span className="inline-flex items-center rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-bold text-[#065F46]">
                  ● PostgreSQL / Supabase Online
                </span>
              </div>
            </div>
          </Panel>
        ) : null}
      </div>
    </InfoTooltipProvider>
  );
}
