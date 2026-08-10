# Fase 5 — E2E Hardening

**Status persetujuan:** Siap Implementasi (Rencana Dipecah Menjadi Subfase)  
**Prasyarat:** Fase 1, 2, 3, dan 4 selesai.

## Tujuan dan Batasan

Menguatkan produk secara menyeluruh setelah seluruh domain refresh selesai melalui audit 14 route aplikasi, responsivitas mobile, aksesibilitas (A11y & Keyboard), penanganan state (Loading, Empty, Error), pembersihan dead code, dan verifikasi regresi otomatis via Playwright E2E.

Di luar cakupan: Fitur domain baru atau perubahan model bisnis yang tidak diperlukan untuk memperbaiki temuan audit.

---

## Subfase Pengerjaan

### Subfase 5.1: Audit 14 Route, State & Pembersihan Dead Code
- **Ruang Lingkup**:
  - Audit state (Loading skeleton, Empty state CTA, Error boundary) pada 14 rute terdaftar (`/`, `/inbox`, `/transactions`, `/wallets`, `/budgets`, `/reimbursements`, `/analytics`, `/recurring`, `/taxonomy`, `/planning`, `/dev-primitives`, `/automation`, `/settings`, `/guide`).
  - Pembersihan komponen usang, temporary fallback, dan dead code yang tidak lagi digunakan setelah migrasi.

---

### Subfase 5.2: Aksesibilitas (A11y), Keyboard & Responsivitas Mobile
- **Ruang Lingkup**:
  - **Keyboard & Focus**: Urutan Tab logis, `focus-visible` jelas pada tombol/input, & penanganan `Esc` pada dialog/drawer/modal.
  - **Aksesibilitas (A11y)**: Tagging HTML5 semantic & atribut ARIA (`aria-label`, `aria-selected`, `aria-hidden`, `role="tabpanel"`).
  - **Responsivitas Mobile**: Bebas dari *horizontal overflow* & target sentuh minimal 44x44px.

---

### Subfase 5.3: Regresi E2E Otomatis (Playwright Test Suite)
- **Ruang Lingkup**:
  - Pembaruan spec pengujian E2E pada `frontend/e2e/*.spec.ts` (menyesuaikan rute `/integrations` & `/guide` yang di-redirect ke `/settings`).
  - Penambahan pengujian E2E untuk preferensi profil & stepper panduan keyboard.
  - Eksekusi `pnpm test:e2e` dengan target **100% PASSING**.

---

## Acceptance Criteria

1. Seluruh 14 rute terdaftar dapat diakses bebas dari error runtime, overflow mobile, atau buntu navigasi.
2. Seluruh dialog & drawer dapat dioperasikan penuh via keyboard (Tab, Enter, Esc).
3. Pengujian otomatis Playwright `pnpm test:e2e` lulus 100%.

---

## Skenario Uji

1. **Audit Layar & State**: Buka 14 rute pada viewport desktop & mobile. Uji state loading & empty.
2. **Audit Keyboard & A11y**: Operasikan aplikasi tanpa mouse, pastikan urutan focus logis & tombol Esc menutup modal.
3. **Automated E2E Suite**: Jalankan `pnpm test:e2e` dan pastikan seluruh spesifikasi hijau (passing).
