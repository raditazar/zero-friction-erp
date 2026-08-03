# Fase 1 — UI Foundation

**Status persetujuan:** 1.1, 1.2 approved; 1.3 pending approval  
**Prasyarat:** Fase 0 selesai  
**Keluaran:** fondasi antarmuka yang konsisten, responsif, dan dapat diakses untuk fase-fase berikutnya.

## Tujuan dan batasan

Tujuan fase ini adalah menyatukan shell aplikasi dan primitive UI agar seluruh domain memakai bahasa visual yang sama. Ini mencakup sidebar desktop, header dan navigation drawer mobile, card, form field, modal, token warna/typography, serta koreksi mojibake/teks rusak.

Di luar cakupan: katalog provider wallet, perubahan model budget, pengaturan produk baru, dan perubahan perilaku bisnis/domain API.

## Perubahan yang direncanakan

| Jenis | Ruang lingkup |
|---|---|
| Tambah | Token desain, primitive shared card/form/modal, pola page header dan state feedback. |
| Ubah | Dashboard layout dan layar yang menggunakan komponen lama agar mengonsumsi primitive bersama; sidebar desktop dan drawer mobile. |
| Hapus | Duplikasi styling/layout yang digantikan primitive, setelah seluruh pemakai dimigrasikan. |

## Kontrak data/API

Tidak ada endpoint, skema database, atau payload domain baru. Kontrak komponen internal harus menerima label, deskripsi, error, disabled/loading, dan `aria-*` yang relevan tanpa memaksakan salinan teks tertentu.

## Layout dan state

- Desktop: sidebar persisten, konten dengan lebar nyaman, header halaman jelas.
- Mobile: header ringkas dengan tombol menu berlabel; drawer dapat ditutup melalui tombol, overlay, dan `Esc`; fokus kembali ke pemicu setelah tutup.
- Empty: card informatif dengan satu CTA utama jika tindakan tersedia.
- Loading: skeleton yang mempertahankan struktur layar, bukan halaman kosong.
- Error: pesan ringkas, tindakan coba lagi bila aman, tanpa menyembunyikan navigasi.

## Acceptance criteria

- Semua layout dashboard tetap dapat dinavigasi keyboard dan fokus terlihat jelas.
- Sidebar tidak memakan ruang konten mobile; drawer memiliki focus management yang benar.
- Card, field, dialog, tombol, dan feedback state memiliki gaya/spacing konsisten.
- Tidak ada mojibake pada teks yang disentuh.
- Tidak ada regresi route atau perubahan kontrak API.

## Skenario uji

1. Periksa desktop dan viewport sempit pada setiap route dashboard yang ada.
2. Navigasi seluruh shell dengan Tab, Shift+Tab, Enter, dan Esc.
3. Uji dialog dan drawer: fokus terkunci saat terbuka dan kembali ke pemicu saat tertutup.
4. Simulasikan state loading, error, dan tanpa data pada minimal satu layar representatif.

## Keputusan yang dibutuhkan

Setujui brief ini untuk membuka implementasi Fase 1.

## Subfase pengerjaan dan approval gate

Setiap subfase dikerjakan berurutan. Hanya subfase **1.1** yang berstatus `Pending approval`; seluruh subfase berikutnya berstatus `Blocked by previous subphase`. Implementasi hanya boleh dimulai setelah persetujuan eksplisit untuk subfase aktif, dan subfase berikutnya baru boleh dibuka setelah hasil subfase sebelumnya disetujui.

| Subfase | Status awal | Fokus dan keluaran | Selesai bila |
|---|---|---|---|
| 1.1 UI contract & inventory | Approved | Membekukan UI terang chart-forward dengan Plus Jakarta Sans, token warna/spacing/typography, inventaris card/form/modal lintas proyek, serta struktur component API. | Tidak ada keputusan visual atau ownership komponen yang ambigu. |
| 1.2 App shell & navigation | Approved | Sidebar desktop, header mobile, drawer, page header, breadcrumb, primary CTA, serta focus management. | Semua route memakai shell responsif yang sama dan navigasi keyboard aman. |
| 1.3 Card & feedback primitives | Pending approval | `AppCard`, `MetricCard`, `EntityCard`, `ListCard`, `DetailCard`, `EmptyState`, `LoadingState`, `ErrorState`, badge, progress, dan action menu. | Semua tampilan data memiliki state normal, kosong, loading, error, dan aksi konsisten. |
| 1.4 Form primitives | Blocked by 1.3 | `FormCard`, `FormField`, text/money/textarea/select/date/time/checkbox/color/search field, responsive form grid, validasi visual, dan submit state. | Semua field berlabel, accessible, menampilkan hint/error, dan aman pada mobile. |
| 1.5 Dialog & confirmation primitives | Blocked by 1.4 | `AppDialog`, `FormDialog`, `ConfirmDialog`, `ReviewDialog`, `SecretRevealDialog`, dan `HelpDialog`; mengganti seluruh overlay manual, `prompt()`, dan `window.confirm()`. | Dialog memiliki focus trap, perilaku Esc/close, busy/error state, dan fokus kembali ke pemicu. |
| 1.6 Migrasi operasi harian | Blocked by 1.5 | Terapkan kit ke Login, Dashboard, Inbox, Buku Besar, Wallet, Anggaran, dan Piutang. | Card, form, modal, dan teks pada domain operasi harian konsisten tanpa perubahan kontrak bisnis/API. |
| 1.7 Migrasi perencanaan & insight | Blocked by 1.6 | Terapkan kit ke Target, Sinking Fund, Kategori/Tag, Recurring, dan Analytics. | Semua form/list/progress/chart shell responsif dan memiliki state feedback yang sama. |
| 1.8 Migrasi administrasi & panduan | Blocked by 1.7 | Terapkan kit ke Automation, Tokens, Settings, dan Panduan. | Aksi token, webhook, dead-letter, status sistem, dan onboarding memakai primitive yang aman dan konsisten. |
| 1.9 Aksesibilitas, responsivitas & closure | Blocked by 1.8 | Audit seluruh route desktop/mobile, keyboard, fokus, kontras, mojibake, typecheck/lint/build, dan regression smoke test. | Acceptance criteria Fase 1 seluruhnya lulus; status Fase 1 dapat diubah menjadi `Done`. |

### Format tracking setiap subfase

Setiap subfase wajib mendokumentasikan status persetujuan, tujuan, komponen/rute terdampak, batas yang tidak termasuk, acceptance criteria, skenario uji desktop/mobile/keyboard/loading/error/empty state, serta handoff berisi ringkasan perubahan dan bukti uji. Persetujuan Anda adalah gate wajib sebelum subfase setelahnya dimulai.

### Ketetapan cakupan migrasi

Fase 1 memigrasikan foundation ke seluruh route. Migrasi terbatas pada shell, reusable card/form/modal, responsive layout, accessibility, feedback state, dan perbaikan teks. Perubahan fitur, API, database, serta logika bisnis tetap berada pada fase domain pemiliknya.
