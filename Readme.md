# Zero-Friction Personal ERP

Zero-Friction Personal ERP is a personal finance operations system designed to reduce manual bookkeeping. It combines a Go backend, a Next.js dashboard, and PostgreSQL to support transaction reconciliation, multi-wallet tracking, reimbursements, sinking funds, recurring rules, and automation-friendly webhook ingestion.

## Project Status

This repository is in early development. The backend exposes the initial API surface and implements core database-backed resources for wallets, categories, tags, transactions, inbox workflows, webhook events, dead-letter queue handling, and reimbursements. Authentication is not production-ready yet; development handlers currently use the seeded demo user until real auth/session handling is added.

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

Create a local environment file from the example and replace the password values as needed:

```powershell
Copy-Item .env.example .env
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
$env:DATABASE_URL = "postgres://zero_friction_erp:change-me-local-only@localhost:5432/zero_friction_erp?sslmode=disable"
go run .\cmd\api
```

The backend listens on `http://localhost:8080` by default.

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
