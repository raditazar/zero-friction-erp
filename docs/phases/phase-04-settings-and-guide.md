# Fase 4 — Settings & Guide

**Status persetujuan:** Siap Implemetasi (Rencana Dipecah Menjadi Subfase)  
**Prasyarat:** Fase 1 selesai dan brief ini disetujui.

## Tujuan dan Batasan

Menjadikan halaman Settings (`/settings`) sebagai tempat terpercaya untuk profil, preferensi inti, manajemen token API/webhook, dan status sistem; serta menyediakan Panduan Pengguna yang menjelaskan alur utama aplikasi (Wallet → Transaksi & Inbox → Monthly Budget → Evaluasi) secara interaktif dan accessible.

Di luar cakupan: Role/team management (RBAC), billing external, sistem auth OAuth pihak ketiga baru, dan menyimpan secret tanpa masking/proteksi backend.

---

## Subfase Pengerjaan

### Subfase 4.1: Profile & Preferensi Inti
- **Ruang Lingkup**:
  - Form profil berkolom tunggal (*single column layout*) yang responsif.
  - Field: Nama Lengkap, Email (read-only/display), Bahasa/Locale (`ID`/`EN`), Format Tanggal (`DD/MM/YYYY`, `YYYY-MM-DD`), dan Mata Uang Default (`IDR`, `USD`, `SGD`).
  - Validasi pesan error pada level field dan server, tombol simpan dengan status loading & toast notification feedback.
- **Kontrak Data/API**:
  - `GET /api/v1/user/profile` -> Mengembalikan data profil & preferensi.
  - `PUT /api/v1/user/profile` -> Menyimpan perubahan nama, locale, date_format, default_currency.

---

### Subfase 4.2: Tokens, Webhooks & Status Sistem
- **Ruang Lingkup**:
  - **API Tokens**: Tabel/Daftar token terdaftar dengan masking secret (`sk_live_...4a2b`), modal *One-Time Secret Copy* saat pembuat token baru, dan opsi *Revoke*.
  - **Webhooks**: Form pendaftaran URL webhook, seleksi event listener, status active/suspended, dan opsi rotasi secret.
  - **Status Sistem**: Card indikator kesehatan sistem yang mengambil data dari endpoint `/api/v1/health` (Status DB, API, Storage) dilengkapi skeleton loading & pesan pemulihan (*actionable recovery guide*).
- **Kontrak Data/API**:
  - `GET /api/v1/tokens`, `POST /api/v1/tokens`, `DELETE /api/v1/tokens/:id`
  - `GET /api/v1/webhooks`, `POST /api/v1/webhooks`, `DELETE /api/v1/webhooks/:id`
  - `GET /api/v1/health` -> Mengembalikan `{ status: "healthy", services: { db: "up", storage: "up" } }`.

---

### Subfase 4.3: Panduan Pengguna & Onboarding Interaktif
- **Ruang Lingkup**:
  - Stepper / Carousel Card 4-langkah di tab Panduan:
    1. **Wallet & Rekening**: Inisialisasi dompet dan saldo awal.
    2. **Transaksi & Inbox**: Pencatatan transaksi & nota inbox.
    3. **Monthly Budget**: Alokasi anggaran bulanan per kategori.
    4. **Evaluasi & Laporan**: Analisis & statistik keuangan.
  - *Progress Indicator* dan dukungan **Navigasi Keyboard Penuh** (`ArrowLeft`, `ArrowRight`, `Tab`, `Enter/Space`).
  - Responsif untuk layar Desktop & Mobile.

---

## Layout dan State Navigasi (`/settings`)

- **Routing**: Single Page `/settings` dengan Tab Navigasi di Sidebar/Header yang tersinkronisasi via query param (`/settings?tab=profile`, `/settings?tab=tokens-status`, `/settings?tab=guide`).
- **Desktop**: Layout 2 kolom (Sidebar Navigasi Tab + Panel Konten Form/Stepper).
- **Mobile**: Navigasi tab horizontal yang scrollable + form 1 kolom.
- **Empty State**: Tampilan CTA yang jelas jika belum ada Token API atau Webhook terdaftar.
- **Loading State**: Skeleton loader untuk profil, token, dan status sistem; secret tidak pernah muncul plain-text setelah modal pertama ditutup.

---

## Acceptance Criteria

1. Pengguna dapat menyimpan perubahan nama dan preferensi (bahasa, format tanggal, currency default) dan data persis setelah reload.
2. Secret API Key disamarkan secara default, dapat disalin hanya via tombol eksolilit *Copy*, dan hanya ditampilkan utuh 1x saat pertama dibuat.
3. Status Sistem menampilkan kondisi operasional real-time dari endpoint `/api/v1/health` dengan skeleton saat loading.
4. Panduan Pengguna dapat diselesaikan penuh dari langkah 1 hingga 4 hanya menggunakan keyboard (tanpa mouse).

---

## Skenario Uji

1. **Uji Profil & Preferensi**: Ubah nama & preferensi, reload halaman, pastikan nilai tersimpan.
2. **Uji Token & Webhook**: Buat token baru, salin secret dari modal, tutup modal, dan pastikan secret di tabel ter-masking (`sk_live_...`).
3. **Uji Status Sistem**: Buka tab status, amati skeleton loader, pastikan indikator hijau/healthy muncul.
4. **Uji Panduan Keyboard**: Buka tab Panduan, gunakan tombol `ArrowRight` dan `ArrowLeft` untuk navigasi antar-step.
