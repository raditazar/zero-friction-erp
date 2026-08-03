# Fase 2 — Wallet Catalog

**Status persetujuan:** Blocked by phase 1  
**Prasyarat:** Fase 1 selesai dan brief ini disetujui.

## Tujuan dan batasan

Membuat pemilihan provider dompet/rekening yang rapi, berlogo saat tersedia, dan tetap jelas bila provider tidak ditemukan. Mata uang dipilih dari daftar terkurasi, bukan input bebas.

Di luar cakupan: sinkronisasi bank, OAuth/open-banking, perubahan perhitungan saldo, dan penggunaan aset logo secara komersial.

## Perubahan yang direncanakan

| Jenis | Ruang lingkup |
|---|---|
| Tambah | Katalog provider berbasis `idn-finlogos`, provider picker yang searchable, fallback inisial/generik, dan dropdown currency terkurasi. |
| Ubah | Form buat/edit wallet agar menyimpan dan menampilkan provider terpilih. |
| Hapus | Input/provider hard-code yang menjadi duplikat setelah migrasi. |

## Kontrak data/API

- Tambahkan `provider_slug` nullable pada wallet melalui migrasi terpisah; nilai harus berasal dari katalog versi aplikasi atau `null` untuk custom/legacy.
- Create/update/read wallet menyertakan `provider_slug` tanpa mengubah semantik saldo atau transfer.
- Daftar currency memiliki kode ISO (mis. `IDR`, `USD`, `SGD`); nilai tersimpan tetap kode, bukan label tampilan.
- Pin versi dependency `idn-finlogos`; sertakan atribusi dan NOTICE lisensi sebelum aset dipaketkan.

## Layout dan state

- Desktop: picker berada dalam form wallet, hasil menampilkan logo, nama, dan slug bila diperlukan untuk debugging.
- Mobile: picker membuka panel/dialog dengan target sentuh memadai dan pencarian tetap mudah.
- Empty: wallet pertama menjelaskan manfaat dan CTA “Tambah wallet”.
- Loading: placeholder field/picker selama katalog atau wallet dimuat.
- Error: kegagalan simpan mempertahankan isian; logo gagal dimuat jatuh ke fallback tanpa menghambat submit.

## Acceptance criteria

- Wallet legacy tanpa `provider_slug` tetap dapat dibuka dan diedit.
- Provider terpilih tersimpan lalu muncul konsisten di daftar dan detail.
- Currency hanya menerima nilai yang ada di daftar terkurasi.
- Fallback visual, atribusi, NOTICE, dan pin versi tersedia.

## Skenario uji

1. Buat, edit, dan buka ulang wallet dengan provider serta currency.
2. Buka wallet legacy dengan provider null dan simpan tanpa memilih provider.
3. Paksa URL logo gagal lalu pastikan fallback tetap accessible.
4. Uji keyboard, pencarian picker, dan viewport mobile.

## Keputusan yang dibutuhkan

Setujui brief ini setelah Fase 1 selesai untuk membuka implementasi Fase 2.
