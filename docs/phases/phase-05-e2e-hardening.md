# Fase 5 — E2E Hardening

**Status persetujuan:** Blocked by phases 2–4  
**Prasyarat:** Fase 2, 3, dan 4 selesai serta brief ini disetujui.

## Tujuan dan batasan

Menguatkan produk setelah seluruh domain refresh selesai melalui audit route menyeluruh, responsivitas, aksesibilitas, state loading/error/empty, dan regresi fungsional.

Di luar cakupan: fitur domain baru atau perubahan model bisnis yang tidak diperlukan untuk memperbaiki temuan audit.

## Perubahan yang direncanakan

| Jenis | Ruang lingkup |
|---|---|
| Tambah | Acceptance matrix, regression checklist, dan tes otomatis/manual untuk celah yang teridentifikasi. |
| Ubah | Perbaikan lintas layar yang diperlukan berdasarkan temuan E2E dan accessibility audit. |
| Hapus | Dead UI, fallback sementara, atau duplikasi yang terbukti tidak lagi dipakai setelah migrasi. |

## Kontrak data/API

Tidak ada kontrak baru secara default. Perbaikan kontrak yang ditemukan harus backward-compatible atau dipisahkan menjadi keputusan/brief tambahan; setiap perubahan endpoint dilindungi regression test.

## Layout dan state

Semua route dalam matriks berikut harus lolos desktop dan mobile, keyboard, serta empty/loading/error yang relevan: Dashboard, Inbox, Buku Besar, Wallet, Anggaran, Piutang, Target, Kategori/Tag, Recurring, Analytics, Settings, dan Panduan.

## Acceptance criteria

- Tidak ada route prioritas yang mengalami error runtime, navigasi buntu, overflow mobile, atau focus trap rusak.
- Semua form menampilkan label, validasi, disabled/loading submit, dan error yang dapat dipahami.
- Semua dialog/drawer dapat dioperasikan keyboard dan pembaca layar secara layak.
- Alur lintas domain wallet, transaksi/inbox, budget, settings, dan guide bekerja tanpa regresi.

## Skenario uji

1. Jalankan matriks route di atas pada desktop dan viewport mobile.
2. Jalankan happy path dan failure path untuk tambah/edit/hapus yang tersedia di setiap domain.
3. Audit Tab order, focus visible, Escape, kontras, dan pembaca layar pada primitive bersama.
4. Jalankan test suite, typecheck/lint/build yang tersedia dan catat hasilnya pada laporan fase.

## Keputusan yang dibutuhkan

Setujui brief ini setelah Fase 2–4 selesai untuk membuka implementasi dan penutupan Fase 5.
