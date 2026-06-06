# Zero-Friction Personal ERP

Personal ERP untuk rekonsiliasi transaksi, multi-wallet, sinking funds, reimbursement, dan routing pendapatan ad-hoc.

## Tech Stack

- Backend: Go `1.25.7`
- Frontend: Next.js `16.2.7`, React `19.2.4`, TypeScript, Tailwind CSS `4`
- Package manager frontend: pnpm `10.18.3`
- Database/auth target: Supabase PostgreSQL

## Setup Yang Sudah Dilakukan

- Membuat scaffold frontend di `frontend/` dengan Next.js App Router, TypeScript, Tailwind, dan ESLint.
- Menginstal dependency lokal frontend lewat pnpm.
- Membuat modul backend Go di `backend/`.
- Menambahkan HTTP server awal dengan:
  - `GET /healthz`
  - `POST /webhooks/transactions`

Tidak ada instalasi global baru yang dilakukan. Go, Node.js, npm, pnpm, dan Git sudah tersedia di mesin ini.

## Menjalankan Backend

```powershell
cd backend
go run .\cmd\api
```

Backend default berjalan di `http://localhost:8080`.

Atau dari root repo:

```powershell
.\scripts\dev-backend.cmd
```

## Menjalankan Frontend

```powershell
cd frontend
pnpm.cmd dev
```

Frontend default berjalan di `http://localhost:3000`.

Atau dari root repo:

```powershell
.\scripts\dev-frontend.cmd
```

Catatan Windows PowerShell: gunakan `pnpm.cmd` atau `npm.cmd` bila `pnpm`/`npm` terblokir oleh Execution Policy.

## Verifikasi

```powershell
cd backend
go test ./...

cd ..\frontend
pnpm.cmd lint
pnpm.cmd build
```
