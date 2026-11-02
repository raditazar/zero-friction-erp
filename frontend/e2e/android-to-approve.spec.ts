import { createHash } from 'crypto';
import { Client } from 'pg';
import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Unified scenario: Android notification -> reviewed in the PWA Inbox on a phone ->
 * approved -> wallet balance and monthly budget mutate by exactly the notified amount.
 *
 * Needs the real stack (docker-compose.e2e.yml + `next start` with BACKEND_URL=http://localhost:8081):
 *   E2E_FULLSTACK=1 npx playwright test --project=iphone --project=pixel android-to-approve
 */
test.skip(!process.env.E2E_FULLSTACK, 'requires the Docker E2E stack (set E2E_FULLSTACK=1)');
test.describe.configure({ mode: 'serial' });

const API = process.env.E2E_API_URL || 'http://localhost:8081';
const DB = process.env.E2E_DATABASE_URL || 'postgresql://erp_user:erp_password@localhost:5433/zero_friction_erp_e2e';

// Seeded by database/migrations/002_seed_data.sql
const USER_ID = '00000000-0000-0000-0000-000000000001';
const GOPAY_WALLET = '10000000-0000-0000-0000-000000000003';
const FOOD_CATEGORY = '20000000-0000-0000-0000-000000000001';

const SESSION_TOKEN = 'e2e-session-token';
const WEBHOOK_TOKEN = 'zfe_wh_e2e_token';
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const AMOUNT = 35000;
const period = new Date().toISOString().slice(0, 7);
const userHeaders = { Cookie: `zfe_session=${SESSION_TOKEN}` };

function notification(
  device: string,
  text = 'Kamu berhasil bayar Rp35.000 ke Kopi Kenangan',
  postedAt = new Date().toISOString(),
) {
  return {
    device_id: device,
    app_name: 'GoPay',
    package_name: 'com.gojek.app',
    title: 'Pembayaran Berhasil',
    text,
    posted_at: postedAt,
  };
}

async function balance(request: APIRequestContext) {
  const res = await request.get(`${API}/analytics/wallet-balances`, { headers: userHeaders });
  expect(res.ok()).toBeTruthy();
  const rows: Array<{ wallet_id: string; curr_balance: string | number }> = await res.json();
  return Number(rows.find((r) => r.wallet_id === GOPAY_WALLET)?.curr_balance);
}

async function foodSpent(request: APIRequestContext) {
  const res = await request.get(`${API}/budgets?period=${period}`, { headers: userHeaders });
  expect(res.ok()).toBeTruthy();
  const body: {
    category_spent?: Record<string, number>;
    allocations?: Array<{ category_id: string; spent_amount?: number | string }>;
  } = await res.json();
  const fromAlloc = body.allocations?.find((a) => a.category_id === FOOD_CATEGORY)?.spent_amount;
  return Number(body.category_spent?.[FOOD_CATEGORY] ?? fromAlloc ?? 0);
}

async function pushNotification(request: APIRequestContext, payload: ReturnType<typeof notification>) {
  const res = await request.post(`${API}/integrations/android/notifications`, {
    headers: { 'X-Webhook-Token': WEBHOOK_TOKEN },
    data: payload,
  });
  return { status: res.status(), body: await res.json() };
}

test.beforeAll(async ({ request }) => {
  const db = new Client({ connectionString: DB });
  await db.connect();
  try {
    await db.query(
      `insert into auth_sessions (user_id, session_hash, expires_at)
       values ($1, $2, now() + interval '1 day') on conflict (session_hash) do nothing`,
      [USER_ID, sha256(SESSION_TOKEN)],
    );
    await db.query(
      `insert into webhook_tokens (user_id, name, token_hash, token_prefix, source)
       values ($1, 'e2e-android', $2, 'zfe_wh_e2e', 'android') on conflict (token_hash) do nothing`,
      [USER_ID, sha256(WEBHOOK_TOKEN)],
    );
    // Clean slate so balances, budgets and dedup history are deterministic.
    await db.query('delete from webhook_events where user_id = $1', [USER_ID]);
    await db.query('delete from transactions where user_id = $1', [USER_ID]);
  } finally {
    await db.end();
  }

  const alloc = await request.put(`${API}/budgets/allocations`, {
    headers: userHeaders,
    data: { period, allocations: [{ category_id: FOOD_CATEGORY, allocated_amount: 500000 }] },
  });
  expect(alloc.ok(), await alloc.text()).toBeTruthy();
});

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    { name: 'zfe_session', value: SESSION_TOKEN, url: baseURL || 'http://localhost:3000' },
  ]);
});

test('Android notification -> Inbox approve mutates wallet balance and monthly budget', async ({ page, request }) => {
  const walletBefore = await balance(request);
  const spentBefore = await foodSpent(request);

  // 1. Notification arrives from the Android device.
  const pushed = await pushNotification(request, notification('e2e-pixel-1'));
  expect(pushed.status).toBe(202);
  expect(pushed.body.status).toBe('accepted');
  const txId: string = pushed.body.transaction.id;
  expect(pushed.body.transaction.status).toBe('needs_review');

  // Staged only: nothing has moved yet.
  expect(await balance(request)).toBe(walletBefore);

  // Categorise as Food so it counts against the budget (auto-category depends on merchant hints).
  const patched = await request.patch(`${API}/transactions/${txId}`, {
    headers: userHeaders,
    data: { category_id: FOOD_CATEGORY },
  });
  expect(patched.ok(), await patched.text()).toBeTruthy();

  // 2. Review it in the PWA Inbox on the phone.
  await page.goto(`/inbox?id=${txId}`);
  await expect(page.getByText('Kopi Kenangan').first()).toBeVisible();

  // 3. Approve.
  await page.getByRole('button', { name: /Setujui \(Approve\)/ }).click();
  await expect(page.getByText('Transaksi berhasil disetujui.')).toBeVisible();

  // The item leaves the inbox optimistically.
  await expect(page.getByRole('button', { name: /Setujui \(Approve\)/ })).toHaveCount(0);

  // 4. Ledger effects are exact.
  await expect.poll(() => balance(request)).toBe(walletBefore - AMOUNT);
  await expect.poll(() => foodSpent(request)).toBe(spentBefore + AMOUNT);
});

test('identical notification inside the same minute is dropped (Layer 1) and changes nothing', async ({ request }) => {
  const before = await balance(request);
  const text = 'Kamu berhasil bayar Rp12.500 ke Warung Dedup';
  // Same posted_at => same minute bucket => same dedup hash (no flake across a minute rollover).
  const postedAt = new Date().toISOString();
  const first = await pushNotification(request, notification('e2e-pixel-2', text, postedAt));
  expect(first.status).toBe(202);
  const second = await pushNotification(request, notification('e2e-pixel-2', text, postedAt));
  expect(second.status).toBe(200);
  expect(second.body.status).toBe('duplicate_dropped');
  expect(second.body.layer).toBe(1);
  // Still only staged; balance untouched.
  expect(await balance(request)).toBe(before);
});

test('cross-source duplicate is flagged in the Inbox and "Tetap Simpan" approves both', async ({ page, request }) => {
  const before = await balance(request);
  const manual = await request.post(`${API}/transactions`, {
    headers: userHeaders,
    data: {
      wallet_id: GOPAY_WALLET,
      type: 'expense',
      status: 'approved',
      amount: 77000,
      merchant: 'Bakso Duplikat',
      category_id: FOOD_CATEGORY,
      transaction_at: new Date().toISOString(),
    },
  });
  expect(manual.ok(), await manual.text()).toBeTruthy();
  expect(await balance(request)).toBe(before - 77000);

  const pushed = await pushNotification(request, notification('e2e-pixel-3', 'Kamu berhasil bayar Rp77.000 ke Bakso Duplikat'));
  expect(pushed.status).toBe(202);
  const txId: string = pushed.body.transaction.id;
  expect(pushed.body.transaction.duplicate_of_id).toBeTruthy();

  await page.goto(`/inbox?id=${txId}`);
  await expect(page.getByText(/Hapus Duplikat/).first()).toBeVisible();

  await page.getByRole('button', { name: /Tetap Simpan \(Beli 2x\)/ }).first().click();
  await expect.poll(() => balance(request)).toBe(before - 77000 * 2);
});
