"use client";

import { Panel } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";


export default function GuidePage() {
  return (
    <InfoTooltipProvider>
      <div className="p-6 bg-[#FBF9F5] min-h-screen grid gap-6 max-w-5xl">
      <MobilePageHeader />
        <div className="border-b border-[#E0DDD6] pb-4">
          <div className="flex items-center gap-1.5">
            <p className="eyebrow text-[#5A5A5A]">Pusat Dokumentasi & Bantuan</p>
            <InfoTooltip content="Panduan visual lengkap cara menggunakan Zero-Friction Personal ERP dan integrasi iPhone Shortcut." />
          </div>
          <h2 className="text-2xl font-extrabold text-[#1A1A1A]">Panduan Penggunaan Program</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Guide Card 1: iPhone Shortcut Setup */}
          <Panel className="bg-[#1B2326] border border-[#273538] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📱</span>
                <h3 className="text-lg font-bold text-[#F5FEFD]">1. Setup iPhone Shortcut (iOS Automation)</h3>
              </div>
              <p className="text-xs text-[#F5FEFD]/60 leading-relaxed">
                Kirim nota, tangkapan layar Apple Pay/QRIS, atau pesan teks langsung dari iPhone tanpa perlu membuka browser.
              </p>
              <ol className="mt-4 grid gap-2 text-xs text-[#F5FEFD]/80 font-medium list-decimal pl-4">
                <li>Buka menu <span className="font-bold text-[#F5FEFD]">Pengaturan & Profil (/settings)</span> -&gt; Tab API Keys.</li>
                <li>Buat Key baru untuk iPhone Anda dan salin API Token tersebut.</li>
                <li>Buka aplikasi Shortcuts di iPhone -&gt; Tambah aksi <span className="font-bold text-[#F5FEFD]">"Get Contents of URL"</span>.</li>
                <li>Masukkan URL Endpoint: <code className="font-mono text-[11px] bg-[#242E32] px-1 py-0.5 rounded border border-[#273538] text-[#10F5CC]">POST /api/v1/webhooks/ingest</code>.</li>
                <li>Masukkan Header: <code className="font-mono text-[11px] bg-[#242E32] px-1 py-0.5 rounded border border-[#273538] text-[#10F5CC]">Authorization: Bearer YOUR_TOKEN</code>.</li>
              </ol>
            </div>
            <div className="mt-6 pt-3 border-t border-[#273538]">
              <span className="text-xs font-bold text-[#818CF8]">✓ Zero-Friction Receipt Upload Ready</span>
            </div>
          </Panel>

          {/* Guide Card 2: AI Staging & Kotak Masuk */}
          <Panel className="bg-[#1B2326] border border-[#273538] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📥</span>
                <h3 className="text-lg font-bold text-[#F5FEFD]">2. Verifikasi Staging Kotak Masuk (/inbox)</h3>
              </div>
              <p className="text-xs text-[#F5FEFD]/60 leading-relaxed">
                Semua hasil parsing Gemini AI / OCR (<code className="font-mono text-[11px] bg-[#242E32] px-1 py-0.5 rounded text-[#10F5CC]">confidence &lt; 1.0</code>) secara ketat diawasi dan ditampung terlebih dahulu di <span className="font-bold text-[#F5FEFD]">Kotak Masuk</span> (DEC-02 & DEC-07).
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-[#F5FEFD]/80 font-medium list-disc pl-4">
                <li><span className="font-bold text-[#F5FEFD]">1-Click Approve</span>: Tekan "✓ Setujui" untuk langsung memasukkan ke Buku Besar.</li>
                <li><span className="font-bold text-[#F5FEFD]">1-Click Direct Edit (DEC-12)</span>: Koreksi merchant, nominal, atau kategori dalam 1 modal.</li>
                <li><span className="font-bold text-[#F5FEFD]">Save as Pattern Rule</span>: Centang opsi simpan pola agar transaksi serupa berikutnya langsung auto-approve (<code className="font-mono text-[11px] text-[#10F5CC]">confidence = 1.0</code>).</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#273538]">
              <span className="text-xs font-bold text-[#10F5CC]">✓ 100% Data Integrity Guaranteed</span>
            </div>
          </Panel>

          {/* Guide Card 3: Single-Record Transfer & Fees */}
          <Panel className="bg-[#1B2326] border border-[#273538] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">💸</span>
                <h3 className="text-lg font-bold text-[#F5FEFD]">3. Transfer Antar Dompet & Biaya Admin (DEC-04/09)</h3>
              </div>
              <p className="text-xs text-[#F5FEFD]/60 leading-relaxed">
                Pindahkan dana antar rekening tanpa membuat transaksi ganda palsu.
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-[#F5FEFD]/80 font-medium list-disc pl-4">
                <li>Dompet Asal berkurang sebesar <span className="font-bold text-[#F5FEFD]">Nominal + Biaya Admin</span>.</li>
                <li>Dompet Tujuan bertambah sebesar <span className="font-bold text-[#F5FEFD]">Nominal</span>.</li>
                <li>Biaya Admin otomatis dicatat sebagai beban bank tanpa duplikasi baris.</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#273538]">
              <span className="text-xs font-bold text-[#818CF8]">✓ Single Record Atomic Transfer</span>
            </div>
          </Panel>

          {/* Guide Card 4: Zero-Based Budgeting & Deficit Shift */}
          <Panel className="bg-[#1B2326] border border-[#273538] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📊</span>
                <h3 className="text-lg font-bold text-[#F5FEFD]">4. Zero-Based Budgeting & Shift Defisit (DEC-06)</h3>
              </div>
              <p className="text-xs text-[#F5FEFD]/60 leading-relaxed">
                Kelola anggaran dengan fleksibilitas FinTech YNAB "Roll with the Punches".
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-[#F5FEFD]/80 font-medium list-disc pl-4">
                <li>Tutup defisit di bulan berjalan via 1-Click <span className="font-bold text-[#F5FEFD]">"Shift Budget"</span> dari kategori donor bersisa positif.</li>
                <li>Sisa defisit yang belum ditutup otomatis memotong alokasi bulan berikutnya.</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#273538]">
              <span className="text-xs font-bold text-[#10F5CC]">✓ Balanced Zero-Based System</span>
            </div>
          </Panel>
        </div>
      </div>
    </InfoTooltipProvider>
  );
}
