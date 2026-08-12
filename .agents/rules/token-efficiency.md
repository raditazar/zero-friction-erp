# Rule: Smart Context & Token Efficiency

## 1. Context Scanning (Lakukan Terarah di Awal)
- Pindai codebase 1x di awal menggunakan `grep_search` atau `list_dir` untuk memanfaatkan fungsi/helper yang sudah ada.
- DILARANG membaca ulang (`view_file` / `Get-Content`) file yang sama secara berturut-turut jika file tersebut tidak mengalami perubahan baru.

## 2. Dilarang Polling Loop & Menunggu
- DILARANG MENGGUNAKAN `Start-Sleep`, `sleep`, atau polling status (`git status` / `manage_task`) dalam loop.
- Jangan menunda eksekusi jika rencana edit sudah jelas.

## 3. Verifikasi Sekali di Akhir
- Jalankan perintah tes/build (`tsc --noEmit` / `go test`) MAKSIMAL 1x di akhir pekerjaan.
- Begitu verifikasi sukses (exit code 0), LANGSUNG hentikan panggilan tool dan berikan laporan ringkas.
