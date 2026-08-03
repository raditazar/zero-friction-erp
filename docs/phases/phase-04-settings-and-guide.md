# Fase 4 — Settings & Guide

**Status persetujuan:** Blocked by phase 1  
**Prasyarat:** Fase 1 selesai dan brief ini disetujui.

## Tujuan dan batasan

Menjadikan Settings sebagai tempat terpercaya untuk profil, preferensi inti, token/webhook, dan status sistem; serta menyediakan Panduan yang menjelaskan alur utama tanpa mengubah aturan finansial.

Di luar cakupan: role/team management, billing, pembuatan integrasi pihak ketiga baru, dan menyimpan rahasia tanpa proteksi backend yang disepakati.

## Perubahan yang direncanakan

| Jenis | Ruang lingkup |
|---|---|
| Tambah | Kelompok settings yang jelas, status sistem, panduan onboarding dan alur transaksi/budget/wallet. |
| Ubah | Form profil/preferensi dan tampilan token/webhook agar aman, dapat dipahami, serta responsif. |
| Hapus | Duplikasi navigasi/pengaturan yang membingungkan setelah seluruh entry point dialihkan. |

## Kontrak data/API

- Profil dan preferensi hanya mengirim field yang didukung endpoint saat ini; validasi dilakukan di klien dan server.
- Nilai token/secret disamarkan secara default dan tidak dikirim kembali utuh oleh API setelah dibuat.
- Webhook menunjukkan endpoint/status/rotasi sesuai kontrak backend; perubahan kontrak memerlukan spesifikasi endpoint serta otorisasi terpisah.
- Status sistem memuat data operasional yang aman ditampilkan, bukan kredensial atau payload sensitif.

## Layout dan state

- Desktop: navigasi section settings, konten form berkolom tunggal yang mudah dipindai, status sistem terpisah.
- Mobile: daftar section dan form satu kolom, aksi utama sticky hanya bila tidak menutupi field.
- Empty: bila token/webhook belum ada, jelaskan fungsi dan CTA pembuatan yang aman.
- Loading: skeleton section/status; secret tidak pernah di-flash dalam plaintext.
- Error: pesan per field dan error sistem yang actionable tanpa membocorkan detail rahasia.

## Acceptance criteria

- Pengguna dapat menyimpan profil dan preferensi yang valid dan melihat hasilnya setelah reload.
- Secret disamarkan, dapat disalin hanya lewat aksi eksplisit, dan tidak bocor pada log/UI error.
- Status sistem mudah dipahami serta menyediakan langkah pemulihan yang sesuai.
- Panduan menjelaskan alur wallet → transaksi/inbox → budget → evaluasi.

## Skenario uji

1. Ubah profil/preferensi, reload, dan pastikan persistensi.
2. Buat/lihat/rotasi token atau webhook sesuai API yang tersedia; periksa masking.
3. Uji state status sehat, loading, dan gagal.
4. Selesaikan panduan sebagai pengguna baru di desktop dan mobile, seluruhnya dengan keyboard.

## Keputusan yang dibutuhkan

Setujui brief ini setelah Fase 1 selesai untuk membuka implementasi Fase 4.
