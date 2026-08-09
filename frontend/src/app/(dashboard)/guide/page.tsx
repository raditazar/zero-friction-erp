"use client";

import { Panel } from "@/components/ui/dashboard";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

export default function GuidePage() {
  return (
    <InfoTooltipProvider>
      <div className="p-6 bg-[#F4F3EE] min-h-screen grid gap-6 max-w-5xl">
        <MobilePageHeader />
        <div className="border-b border-[#E0DDD6] pb-4">
          <div className="flex items-center gap-1.5">
            <p className="eyebrow text-[#5A5A5A]">Interactive Knowledge Base</p>
            <InfoTooltip content="Panduan interaktif dan referensi pintasan untuk Zero-Friction Personal ERP." />
          </div>
          <h2 className="text-2xl font-extrabold text-[#1A1A1A]">Pusat Dokumentasi &amp; Bantuan</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card: Pintasan Keyboard */}
          <Panel className="bg-[#FFFFFF] border border-[#E8E6E1] rounded-xl p-6 flex flex-col justify-between md:col-span-2">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⌨️</span>
                  <h3 className="text-lg font-bold text-[#1A1A1A]">Pintasan Keyboard (Shortcuts)</h3>
                </div>
                <button
                  onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))}
                  className="bg-[#25221F] text-[#FFFEFC] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#3D3935] transition-colors"
                >
                  Buka Panduan Pintasan Lengkap (Cmd+/)
                </button>
              </div>
              <p className="text-sm text-[#6E6D7A] leading-relaxed mb-4">
                  Sistem tidak akan bekerja jika Anda membutuhkan waktu lebih dari 5 detik untuk mencatat. Manfaatkan fitur &quot;Voice to Text&quot; Siri atau Shortcut kamera jika Anda lelah mengetik manual.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-[#F9F8F5] border border-[#E8E6E1] rounded-lg">
                  <p className="text-sm font-medium text-[#1A1A1A]">&quot;Zero-Friction&quot; bukan sekadar jargon</p>
                  <div className="flex items-center gap-1.5">
                    <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] font-mono shadow-sm px-1.5 py-0.5 rounded text-xs">Cmd</kbd>
                    <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] font-mono shadow-sm px-1.5 py-0.5 rounded text-xs">K</kbd>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#F9F8F5] border border-[#E8E6E1] rounded-lg">
                  <span className="text-sm font-medium text-[#25221F]">Buka Bantuan</span>
                  <div className="flex items-center gap-1.5">
                    <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] font-mono shadow-sm px-1.5 py-0.5 rounded text-xs">Cmd</kbd>
                    <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] font-mono shadow-sm px-1.5 py-0.5 rounded text-xs">/</kbd>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#F9F8F5] border border-[#E8E6E1] rounded-lg">
                  <span className="text-sm font-medium text-[#25221F]">Tutup Dialog</span>
                  <div className="flex items-center gap-1.5">
                    <kbd className="bg-[#EFECE6] border border-[#DCD7CE] text-[#1A1A1A] font-mono shadow-sm px-1.5 py-0.5 rounded text-xs">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Guide Card 1: iPhone Shortcut Setup */}
          <Panel className="bg-[#FFFFFF] border border-[#E8E6E1] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📱</span>
                <h3 className="text-lg font-bold text-[#1A1A1A]">1. Setup iPhone Shortcut (iOS Automation)</h3>
              </div>
              <p className="text-xs text-[#6E6D7A] leading-relaxed">
                Kirim nota, tangkapan layar Apple Pay/QRIS, atau pesan teks langsung dari iPhone tanpa perlu membuka browser.
              </p>
              <ol className="mt-4 grid gap-2 text-xs text-[#6E6D7A] font-medium list-decimal pl-4">
                <li>Buka menu <span className="font-bold text-[#1A1A1A]">Pengaturan &amp; Profil (/settings)</span> -&gt; Tab API Keys.</li>
                <li>Buat Key baru untuk iPhone Anda dan salin API Token tersebut.</li>
                <li>Buka aplikasi Shortcuts di iPhone -&gt; Tambah aksi <span className="font-bold text-[#1A1A1A]">&quot;Get Contents of URL&quot;</span>.</li>
                <li>Masukkan URL Endpoint: <code className="font-mono text-[11px] bg-[#F9F8F5] px-1 py-0.5 rounded border border-[#E8E6E1] text-[#047857]">POST /api/v1/webhooks/ingest</code>.</li>
                <li>Masukkan Header: <code className="font-mono text-[11px] bg-[#F9F8F5] px-1 py-0.5 rounded border border-[#E8E6E1] text-[#047857]">Authorization: Bearer YOUR_TOKEN</code>.</li>
              </ol>
            </div>
            <div className="mt-6 pt-3 border-t border-[#E8E6E1]">
              <span className="text-xs font-bold text-[#047857]">✓ Zero-Friction Receipt Upload Ready</span>
            </div>
          </Panel>

          {/* Guide Card 2: AI Staging & Kotak Masuk */}
          <Panel className="bg-[#FFFFFF] border border-[#E8E6E1] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📥</span>
                <h3 className="text-lg font-bold text-[#1A1A1A]">2. Verifikasi Staging Kotak Masuk (/inbox)</h3>
              </div>
              <p className="text-xs text-[#6E6D7A] leading-relaxed">
                Semua hasil parsing Gemini AI / OCR (<code className="font-mono text-[11px] bg-[#F9F8F5] px-1 py-0.5 rounded text-[#047857]">confidence &lt; 1.0</code>) secara ketat diawasi dan ditampung terlebih dahulu di <span className="font-bold text-[#1A1A1A]">Kotak Masuk</span> (DEC-02 &amp; DEC-07).
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-[#6E6D7A] font-medium list-disc pl-4">
                <li><span className="font-bold text-[#1A1A1A]">1-Click Approve</span>: Tekan &quot;✓ Setujui&quot; untuk langsung memasukkan ke Buku Besar.</li>
                <li><span className="font-bold text-[#1A1A1A]">1-Click Direct Edit (DEC-12)</span>: Koreksi merchant, nominal, atau kategori dalam 1 modal.</li>
                <li><span className="font-bold text-[#1A1A1A]">Save as Pattern Rule</span>: Centang opsi simpan pola agar transaksi serupa berikutnya langsung auto-approve (<code className="font-mono text-[11px] text-[#047857]">confidence = 1.0</code>).</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#E8E6E1]">
              <span className="text-xs font-bold text-[#047857]">✓ 100% Data Integrity Guaranteed</span>
            </div>
          </Panel>

          {/* Guide Card 3: Single-Record Transfer & Fees */}
          <Panel className="bg-[#FFFFFF] border border-[#E8E6E1] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">💸</span>
                <h3 className="text-lg font-bold text-[#1A1A1A]">3. Transfer Antar Dompet &amp; Biaya Admin (DEC-04/09)</h3>
              </div>
              <p className="text-xs text-[#6E6D7A] leading-relaxed">
                Pindahkan dana antar rekening tanpa membuat transaksi ganda palsu.
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-[#6E6D7A] font-medium list-disc pl-4">
                <li>Dompet Asal berkurang sebesar <span className="font-bold text-[#1A1A1A]">Nominal + Biaya Admin</span>.</li>
                <li>Dompet Tujuan bertambah sebesar <span className="font-bold text-[#1A1A1A]">Nominal</span>.</li>
                <li>Biaya Admin otomatis dicatat sebagai beban bank tanpa duplikasi baris.</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#E8E6E1]">
              <span className="text-xs font-bold text-[#047857]">✓ Single Record Atomic Transfer</span>
            </div>
          </Panel>

          {/* Guide Card 4: Zero-Based Budgeting & Deficit Shift */}
          <Panel className="bg-[#FFFFFF] border border-[#E8E6E1] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📊</span>
                <h3 className="text-lg font-bold text-[#1A1A1A]">4. Zero-Based Budgeting &amp; Shift Defisit (DEC-06)</h3>
              </div>
              <p className="text-xs text-[#6E6D7A] leading-relaxed">
                Kategori tag harus spesifik dan saling eksklusif (mutually exclusive) agar terhindar dari &quot;double counting&quot;.
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-[#6E6D7A] font-medium list-disc pl-4">
                <li>Tutup defisit di bulan berjalan via 1-Click <span className="font-bold text-[#1A1A1A]">&quot;Shift Budget&quot;</span> dari kategori donor bersisa positif.</li>
                <li>Sisa defisit yang belum ditutup otomatis memotong alokasi bulan berikutnya.</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#E8E6E1]">
              <span className="text-xs font-bold text-[#047857]">✓ Balanced Zero-Based System</span>
            </div>
          </Panel>
        </div>
      </div>
    </InfoTooltipProvider>
  );
}
