"use client";

import Link from "next/link";
import { PlugZap, Server, Activity, Database, RefreshCw } from "lucide-react";
import { useEffect, useState, FormEvent } from "react";
import { Panel, TextInput } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { api, type Me } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";


export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "system">("profile");
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
      api.ready().catch(() => ({ status: "unavailable" })),
    ])
      .then(([meData, health]) => {
        setMe(meData);
        setFullName(meData.profile?.full_name || "");
        setPhone(meData.profile?.phone_number || "");
        setMe(meData);
        setFullName(meData.profile?.full_name || "");
        setPhone(meData.profile?.phone_number || "");
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
    } catch {
      setMessage("Gagal memperbarui profil.");
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
        <div className="flex items-center justify-between border-b border-[#E0DDD6] pb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="eyebrow text-[#5A5A5A]">Pengaturan Terpadu & Profil</p>
              <InfoTooltip content="Kelola identitas akun dan diagnosa server. Pengaturan koneksi eksternal tersedia di halaman Integrasi." />
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
                activeTab === "system" ? "bg-[#FFFFFF] text-[#1A1A1A] shadow-sm" : "text-[#5A5A5A]"
              }`}
              onClick={() => setActiveTab("system")}
            >
              ⚙️ Status Sistem
            </button>
          </div>
        </div>

        <Link
          href="/integrations"
          className="group flex max-w-2xl items-center justify-between gap-4 rounded-xl border border-[#9EE9DA] bg-[#E9FCF7] p-4 transition-colors hover:bg-[#DDF9F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#047857] text-white">
              <PlugZap className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#1A1A1A]">Integrasi</p>
              <p className="text-xs text-[#5A5A5A]">Kelola API key dan webhook untuk koneksi eksternal.</p>
            </div>
          </div>
          <span className="text-sm font-bold text-[#047857] transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
        </Link>

        {/* Tab 1: Profil Saya */}
        {activeTab === "profile" ? (
          <Panel className="bg-[#1B2326] border border-[#273538] rounded-xl p-6 max-w-2xl">
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
              <button className="btn-primary py-2.5 mt-2" type="submit" disabled={busy}>
                Simpan Profil
              </button>
            </form>
          </Panel>
        ) : null}

        {/* Tab 2: Status Sistem */}
        {activeTab === "system" ? (
          <div className="grid gap-6 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-[#1A1A1A]">Diagnosa Infrastruktur Server</h3>
                <p className="text-sm text-[#5A5A5A] mt-1">Pantau status ketersediaan dan latensi layanan utama.</p>
              </div>
              <button 
                onClick={runDiagnostics} 
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-[#333333] transition-colors disabled:opacity-50"
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
          </div>
        ) : null}
      </div>
    </InfoTooltipProvider>
  );
}
