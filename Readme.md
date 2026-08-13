# Zero-Friction Personal ERP

Zero-Friction Personal ERP is a personal finance operations system designed to reduce manual bookkeeping. It combines a Go backend, a Next.js dashboard, and PostgreSQL to support transaction reconciliation, multi-wallet tracking, reimbursements, sinking funds, recurring rules, and automation-friendly webhook ingestion.

## Project Status

This repository is in early development. The backend exposes the initial API surface and implements core database-backed resources for wallets, categories, tags, transactions, inbox workflows, webhook events, dead-letter queue handling, reimbursements, OAuth sessions, API keys, and webhook tokens. Local development can still use the seeded demo user when `APP_ENV=development`.

## Tech Stack

- Backend: Go `1.25.7`
- Frontend: Next.js `16.2.7`, React `19.2.4`, TypeScript, Tailwind CSS `4`
- Frontend package manager: pnpm `10.18.3`
- Database: Dockerized PostgreSQL
- PostgreSQL driver: `pgx/v5`

## Repository Structure

```text
backend/                 Go API service
database/migrations/     PostgreSQL schema and seed data
frontend/                Next.js application
scripts/                 Local development helper scripts
docker-compose.yml       Local PostgreSQL service
```

## Local Setup

Use the root `.env` file for local development. This file is intentionally ignored by Git because it contains database passwords, OAuth client secrets, and API keys.

Minimum local values:

```env
POSTGRES_DB=zero_friction_erp
POSTGRES_USER=zero_friction_user
POSTGRES_PASSWORD=your-local-password
POSTGRES_PORT=55432
DATABASE_URL=postgres://zero_friction_user:your-local-password@127.0.0.1:55432/zero_friction_erp?sslmode=disable

APP_ENV=development
FRONTEND_URL=http://127.0.0.1:3000
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URL=http://127.0.0.1:8080/auth/google/callback
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

PostgreSQL runs migrations from `database/migrations/` when the database volume is created for the first time. If you change initialization scripts after a database has already been created, recreate the local development volume intentionally.

## Running the Backend

From the repository root:

```powershell
.\scripts\dev-backend.cmd
```

Or manually:

```powershell
cd backend
$env:DATABASE_URL = "postgres://zero_friction_user:your-local-password@127.0.0.1:55432/zero_friction_erp?sslmode=disable"
go run .\cmd\api
```

The backend listens on `http://localhost:8080` by default.

Optional backend environment variables:

- `APP_ENV`: set to `development` for local development. Authentication still requires a valid Google session or API token.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`: required for Google OAuth.
- `FRONTEND_URL`: optional redirect target after a successful OAuth callback.
- `GEMINI_API_KEY`: required for Gemini-backed extraction in production.
- `GEMINI_MODEL`: optional Gemini model name. Defaults to `gemini-2.5-flash` when omitted.

## Running the Frontend

```powershell
cd frontend
pnpm.cmd dev
```

The frontend listens on `http://localhost:3000` by default.

On Windows PowerShell, use `pnpm.cmd` or `npm.cmd` if script execution policy blocks the `pnpm` or `npm` shims.

## Database Notes

The schema keeps wallet balances derived from ledger data. `wallets` does not store `curr_balance`; the `wallet_balances` view calculates the current balance from `init_balance` and approved transactions.

Seed data creates:

- Demo user: `demo@zero-friction.local`
- Wallets: `Cash`, `Main Bank`, `E-Wallet`
- Categories: 17 starter categories
- Tags: 7 starter tags

The schema also includes soft delete support via `deleted_at`, recurring rules, saving goals, sinking funds, budget periods, budget categories, budget allocations, income routing rules, income allocations, API keys, and webhook tokens.

## Health Checks

- `GET /healthz`: liveness check
- `GET /readyz`: readiness check with database ping
- `GET /version`: API version metadata

## Vercel Deployment

Deploy this as two Vercel projects. The backend is a Go Serverless Function; the frontend proxies `/api/backend/*`, so OAuth cookies remain first-party to the frontend domain.

1. Import `backend/` as project `zero-friction-erp-api`. Vercel detects `api/index.go`; [`backend/vercel.json`](D:\Source Code\zero-friction-erp\backend\vercel.json) routes every API path to it. Set these production environment variables: `DATABASE_URL`, `APP_ENV=production`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`, `WEBHOOK_SECRET`, `GEMINI_API_KEY`, and optional `GEMINI_MODEL=gemini-2.5-flash`.

   `DATABASE_URL` must be a pooled PostgreSQL connection URL (for example Supabase pooler). Turn on SSL if required by its provider.

2. Import `frontend/` as project `zero-friction-erp-web`. Set server-only `BACKEND_URL` to the API project's Vercel URL, for example `https://zero-friction-erp-api.vercel.app`. Do not set `NEXT_PUBLIC_API_BASE_URL` in production.

3. In Google Cloud OAuth, set `FRONTEND_URL` and add exactly this authorized redirect URI:

```text
https://your-app.vercel.app/api/backend/auth/google/callback
```

The frontend proxy has a 60-second limit, matching the backend's 45-second Gemini request timeout. Add a separate queue/worker only if a future request can exceed that limit.

### Kendala yang mungkin muncul

- **Buka aplikasi setelah lama tidak dipakai terasa lambat.** Contoh: request pertama pagi hari butuh beberapa detik karena function baru dinyalakan. Request berikutnya biasanya normal.
- **Input struk AI gagal karena terlalu lama.** Contoh: foto besar atau Gemini lambat lebih dari batas Vercel; pengguna mendapat error walaupun data belum tersimpan. Kompres foto dan coba lagi. Jika sering terjadi, proses foto perlu dipindah ke worker.
- **Database tiba-tiba menolak koneksi saat banyak request.** Contoh: beberapa tab browser dibuka bersamaan lalu muncul error database. Gunakan URL pooler database, bukan koneksi PostgreSQL langsung.
- **Login Google kembali ke halaman error.** Contoh: callback URL di Google masih URL backend, bukan `https://your-app.vercel.app/api/backend/auth/google/callback`. Salin URL itu persis ke pengaturan Google OAuth.

## Authentication

Google OAuth is exposed through:

- `GET /auth/google/login`
- `GET /auth/google/callback`
- `POST /auth/logout`

Successful OAuth login stores an HTTP-only `zfe_session` cookie. Standard API endpoints accept either that session cookie or `Authorization: Bearer zfe_api_...`. Webhook ingestion accepts `Authorization: Bearer zfe_wh_...` or `X-Webhook-Token: zfe_wh_...`.

## Validation

Backend:

```powershell
cd backend
go test ./...
```

Frontend:

```powershell
cd frontend
pnpm.cmd lint
pnpm.cmd build
```

Docker Compose:

```powershell
docker compose config --quiet
```
