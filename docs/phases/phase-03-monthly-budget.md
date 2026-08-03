# Fase 3 — Monthly Budget

**Status persetujuan:** Blocked by phase 1  
**Prasyarat:** Fase 1 selesai dan brief ini disetujui.

## Tujuan dan batasan

Membuat penganggaran bulanan yang eksplisit: periode valid, alokasi kategori terlihat, defisit mudah dipahami, dana dapat digeser antar kategori dengan aman, dan pengguna baru mendapat panduan jelas.

Di luar cakupan: rollover otomatis lintas bulan (aturan yang ada tetap dihormati), forecasting AI, rekening bersama, dan perubahan definisi transaksi yang disetujui.

## Perubahan yang direncanakan

| Jenis | Ruang lingkup |
|---|---|
| Tambah | Pemilih periode bulanan, ringkasan available/allocated/deficit, alur shift dana, dan empty-state onboarding. |
| Ubah | Tampilan budget kategori dan validasi input agar periodisasi serta angka selalu eksplisit. |
| Hapus | CTA/pesan ambigu yang tidak membedakan periode aktif dan alokasi kategori. |

## Kontrak data/API

- Budget period direpresentasikan sebagai bulan kanonik (`YYYY-MM`) dan divalidasi di klien serta server.
- Alokasi/shift dana memakai nilai desimal yang tidak negatif dan identitas kategori yang ada.
- Operasi shift harus atomik: sumber tidak boleh menjadi negatif kecuali model domain memang mengizinkan defisit yang ditandai jelas.
- Endpoint yang ada dipakai bila kontraknya mencukupi; setiap endpoint/migrasi baru harus dijelaskan dan diuji sebelum dibuat.

## Layout dan state

- Desktop: ringkasan periode di atas, tabel/list kategori dengan angka tabular dan CTA shift yang jelas.
- Mobile: ringkasan ringkas lalu kartu kategori; aksi shift lewat dialog terfokus.
- Empty: jelaskan tiga langkah: pilih bulan, buat kategori, alokasikan dana.
- Loading: skeleton ringkasan dan daftar kategori.
- Error: tampilkan penyebab validasi per field; konflik simpan menawarkan refresh tanpa menghapus input.

## Acceptance criteria

- Pengguna tidak dapat menyimpan periode atau nominal tidak valid.
- Total alokasi, sisa dana, dan defisit konsisten setelah tambah, edit, dan shift.
- Shift dana menunjukkan sumber, tujuan, dan nominal sebelum konfirmasi.
- Pengguna baru dapat memulai budget tanpa data tersembunyi atau istilah ambigu.

## Skenario uji

1. Buat budget pada bulan valid dan tolak format bulan/nominal invalid.
2. Alokasikan dana ke beberapa kategori lalu bandingkan total ringkasan.
3. Shift parsial, seluruh saldo, dan jumlah melebihi sumber.
4. Uji budget tanpa kategori, loading, error API, keyboard dialog, dan mobile.

## Keputusan yang dibutuhkan

Setujui brief ini setelah Fase 1 selesai untuk membuka implementasi Fase 3.
