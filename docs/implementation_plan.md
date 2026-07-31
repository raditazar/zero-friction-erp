# Technical Implementation Plan: Zero-Friction Personal ERP Overhaul

## Goal Description
Overhaul Zero-Friction Personal ERP into a production-grade, WCAG 2.2 compliant financial operations engine with a **Human-Centered Bone White & Soft Black Typography-First Design System**, complete with **Friendly Terminology & Info Tooltips `(i)`**.

All 13 strategic, architectural, and design decisions (DEC-01 through DEC-13) are 100% locked and approved for code execution.

---

## User Review Required

> [!IMPORTANT]
> **Dependencies Installation Approved**:
> We will now install the following approved dependencies in `frontend/`:
> 1. `@tanstack/react-table`: WCAG 2.2 keyboard-navigable data grid engine.
> 2. `zod`: Type-safe schema validation.

> [!NOTE]
> All 13 decisions are signed off by the user. Planning phase is complete.

---

## Proposed Changes

### Component 1: Database & Backend (Go Service)

#### [MODIFY] `database/migrations/001_initial_schema.sql` / `004_overhaul_updates.sql`
- Support atomic single-record transfers with `admin_fee`.
- Update `wallet_balances` view to correctly handle transfer debits (`amount + admin_fee`), transfer admin fees as `Expense: Biaya Admin Bank`, and destination wallet credits.
- Exclude reimbursable transactions (`is_reimbursement = true`) from personal cashflow expense aggregations.

#### [MODIFY] `backend/internal/httpserver/resources.go` & `extended_resources.go`
- Support base64 image (JPEG/PNG) upload and raw OCR text ingestion at `/api/v1/webhooks/ingest`.
- 30-day auto-cleanup retention logic for uploads in `backend/uploads/`.
- Gemini Multimodal AI parsing with 100% Inbox staging for non-exact rule matches.
- Endpoints for Wallet Transfers (`POST /api/v1/transfers`) and Reimbursement Settlement (`POST /api/v1/reimbursements/settle`).

---

### Component 2: Frontend Design System & Tooltip Component (`(i)`)

#### [NEW] `frontend/src/components/ui/info-tooltip.tsx`
- Accessible Info Tooltip `(i)` component providing clear, friendly explanations of financial terms on hover or click.

#### [MODIFY] `frontend/src/app/globals.css`
- Bone White (`#FBF9F5`) and Soft Black (`#1A1A1A`) CSS variables.
- Soft Ivory (`#F0EEE9`) borderless cards.
- Tabular numbers (`font-variant-numeric: tabular-nums`).

---

### Component 3: Frontend Next.js App Router Structure

#### [NEW] `frontend/src/app/(dashboard)/layout.tsx`
- Sidebar layout with active page indicator, `Kotak Masuk` badge counter, and keyboard shortcuts (`/`, `n`, `i`, `Escape`).

#### [NEW] `frontend/src/app/(dashboard)/overview/page.tsx`
- Hero typography KPIs with friendly titles and Info Tooltips `(i)`:
  - Saldo Bersih (Net Worth)
  - Arus Kas Bulanan (Net Cashflow)
  - Kotak Masuk (Pending Review Count)
  - Anggaran Bulanan Terpakai (Budget Usage %)
  - Piutang Belum Cair (Uncollected Reimbursements)

#### [NEW] `frontend/src/app/(dashboard)/inbox/page.tsx`
- **Kotak Masuk (Review Staging)** with 1-click Approve, `Edit & Setujui` (direct OCR correction), or Reject buttons.

#### [NEW] `frontend/src/app/(dashboard)/transactions/page.tsx`
- **Tabel Transaksi Utama** using `@tanstack/react-table` with 2D keyboard navigation.

#### [NEW] `frontend/src/app/(dashboard)/wallets/page.tsx`
- **Daftar Dompet** cards in Soft Ivory (`#F0EEE9`) and **Modal Transfer Antar Dompet** with admin fee input.

#### [NEW] `frontend/src/app/(dashboard)/budgets/page.tsx`
- **Alokasi Anggaran Bulanan** zero-based budgeting grid and progress bars.

#### [NEW] `frontend/src/app/(dashboard)/reimbursements/page.tsx`
- **Daftar Piutang (Klaim Kantor/Teman)** excluded from personal expense totals, with 1-click settlement button.

#### [NEW] `frontend/src/app/(dashboard)/settings/page.tsx`
- Token Webhook (`zfe_wh_...`) generator and iPhone Screenshot shortcut setup guide.

---

## Verification Plan

### Automated Tests
1. **Go API Tests**:
   ```powershell
   cd backend
   go test ./... -v
   ```
2. **Frontend Lint & Build**:
   ```powershell
   cd frontend
   pnpm.cmd lint
   pnpm.cmd build
   ```

### Manual Verification
1. **Friendly Terminology & Tooltip (i)**: Hover/click `(i)` next to "Piutang Kantor" and "Kotak Masuk" -> verify tooltip appears with readable explanation.
2. **iOS Screenshot Multimodal Ingestion**: Send mock image/OCR payload -> verify it stages in `/inbox`.
3. **Transfer with Fee**: Perform wallet transfer with admin fee -> verify source wallet balance decreases by `amount + fee`, destination wallet increases by `amount`.
4. **Reimbursement Exclusion**: Create reimbursable expense -> verify it does NOT inflate personal monthly cashflow expenses.
