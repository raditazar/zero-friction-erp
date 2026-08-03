# Zero-Friction ERP Refresh Roadmap

**Prinsip eksekusi:** satu fase hanya boleh diimplementasikan setelah brief fase tersebut disetujui secara eksplisit. Dokumen ini adalah rencana; tidak ada perubahan produk yang termasuk dalam fase dokumentasi.

## Dashboard fase

| Fase | Status | Fokus | Ketergantungan |
|---|---|---|---|
| 0. Recovery baseline | Done | Pulihkan semua perubahan parsial ke `HEAD`; verifikasi worktree bersih. | Persetujuan brief awal |
| 1. UI foundation | Pending approval | Design system terang, komponen bersama, layout desktop/mobile, dan perbaikan teks rusak. | Fase 0 |
| 2. Wallet catalog | Blocked by phase 1 | Katalog provider, picker logo/fallback, `provider_slug`, mata uang terkurasi. | Fase 1 + persetujuan brief 2 |
| 3. Monthly budget | Blocked by phase 1 | Periode bulanan, alokasi kategori, defisit, shift dana, dan empty state. | Fase 1 + persetujuan brief 3 |
| 4. Settings & guide | Blocked by phase 1 | Profil, preferensi, token/webhook, status sistem, onboarding dan panduan. | Fase 1 + persetujuan brief 4 |
| 5. E2E hardening | Blocked by phases 2–4 | Audit rute, responsivitas, aksesibilitas, state, regresi, dan matriks penerimaan. | Fase 2–4 + persetujuan brief 5 |

Fase 2–4 boleh berjalan paralel hanya sesudah Fase 1 selesai dan setiap brief terkait disetujui.

## Keputusan desain lintas fase

- Gunakan fondasi visual terang yang sudah dibekukan: bone white `#FBF9F5`, warm ivory `#F0EEE9`, soft black `#1A1A1A`, dan indigo `#4F46E5` untuk fokus.
- Interaksi keyboard, focus visible, label form, serta kontras WCAG 2.2 AA adalah persyaratan, bukan polish opsional.
- Empty, loading, dan error merupakan state produk yang harus dirancang di tiap layar.
- `idn-finlogos` hanya boleh dipakai secara non-komersial, dipin pada versi tertentu, disertai atribusi dan NOTICE lisensi.
- Kontrak API tidak diubah diam-diam; setiap perubahan skema/migrasi harus dicatat pada brief fase pemiliknya.
- Bila suatu patch gagal, percobaan berikutnya mengganti file penuh; jangan mengulang patch parsial pada file yang sama.

## Checklist penerimaan E2E (Fase 5)

- [ ] Dashboard
- [ ] Inbox
- [ ] Buku Besar / transaksi
- [ ] Wallet
- [ ] Anggaran
- [ ] Piutang / reimbursement
- [ ] Target / planning
- [ ] Kategori dan tag
- [ ] Recurring
- [ ] Analytics
- [ ] Settings
- [ ] Panduan

## Riwayat keputusan

| Tanggal | Keputusan | Dampak |
|---|---|---|
| 2026-07-31 | Fase 0 dipulihkan ke baseline Git dan worktree diverifikasi bersih. | Seluruh implementasi refresh sebelumnya dibuang; dokumentasi menjadi artefak pertama. |
| 2026-07-31 | Memulai dokumentasi, bukan implementasi UI. | Fase 1 menunggu persetujuan eksplisit. |
