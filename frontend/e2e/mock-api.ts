import type { Page } from '@playwright/test';

/** In-page API mock with realistic fixtures, so UI specs run without the Docker stack. */
const USER = 'u1';
const now = new Date();
const iso = (daysAgo: number, hour = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};
const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export const ME = {
  id: USER,
  email: 'tester@example.com',
  created_at: iso(200),
  profile: { id: USER, full_name: 'Raditya Tester', phone_number: null, avatar: null, locale: 'id', date_format: 'DD/MM/YYYY', default_currency: 'IDR' },
};

const wallet = (id: string, name: string, category: string, provider: string, slug: string | null, init: number) => ({
  id, user_id: USER, name, category, provider, provider_slug: slug, account_number: slug ? '1234567890' : null,
  account_holder: 'Raditya Tester', currency: 'IDR', init_balance: init, is_active: true, created_at: iso(200), updated_at: iso(1),
});

export const WALLETS = [
  wallet('w-bca', 'BCA Utama', 'bank', 'BCA', 'bca', 12500000),
  wallet('w-gopay', 'GoPay', 'wallet', 'GoPay', 'gopay', 350000),
  wallet('w-cash', 'Tunai', 'cash', 'Cash', null, 500000),
];

export const BALANCES = [
  { id: 'w-bca', wallet_id: 'w-bca', user_id: USER, name: 'BCA Utama', category: 'bank', currency: 'IDR', curr_balance: 18345678 },
  { id: 'w-gopay', wallet_id: 'w-gopay', user_id: USER, name: 'GoPay', category: 'wallet', currency: 'IDR', curr_balance: 412500 },
  { id: 'w-cash', wallet_id: 'w-cash', user_id: USER, name: 'Tunai', category: 'cash', currency: 'IDR', curr_balance: 275000 },
];

const category = (id: string, name: string, type: string, parent: string | null = null) => ({
  id, user_id: USER, name, type, parent_id: parent, created_at: iso(200),
});

export const CATEGORIES = [
  category('c-food', 'Makan & Minum', 'expense'),
  category('c-transport', 'Transportasi', 'expense'),
  category('c-fuel', 'Bensin', 'expense', 'c-transport'),
  category('c-bills', 'Tagihan', 'expense'),
  category('c-shop', 'Belanja', 'expense'),
  category('c-salary', 'Gaji', 'income'),
];

const tx = (
  id: string, merchant: string, amount: number, type: string, status: string, daysAgo: number,
  extra: Record<string, unknown> = {},
) => ({
  id, user_id: USER, wallet_id: 'w-gopay', destination_wallet_id: null, type, status, transaction_at: iso(daysAgo, 9 + (amount % 9)),
  merchant, amount, category_id: type === 'income' ? 'c-salary' : 'c-food', is_reimbursement: false, reimbursement_status: 'none',
  related_transaction_id: null, note: null, input_source: 'android', input_mode: 'notification',
  raw_input: `Pembayaran Berhasil: Kamu berhasil bayar ke ${merchant}`, ai_confidence: null, dedup_hash: null, duplicate_of_id: null,
  created_at: iso(daysAgo), updated_at: iso(daysAgo), ...extra,
});

export const INBOX = [
  tx('i1', 'Kopi Kenangan', 35000, 'expense', 'needs_review', 0),
  tx('i2', 'Indomaret Sudirman', 87500, 'expense', 'needs_review', 0, { category_id: 'c-shop' }),
  tx('i3', 'Grab', 42000, 'expense', 'needs_review', 1, { category_id: 'c-transport', duplicate_of_id: 't3' }),
  tx('i4', 'Transfer Masuk Bu Rina', 1500000, 'income', 'needs_review', 1, { wallet_id: 'w-bca' }),
];

export const LEDGER = [
  tx('t1', 'Warung Padang Sederhana', 48000, 'expense', 'approved', 0),
  tx('t2', 'Shell Kemang', 250000, 'expense', 'approved', 0, { category_id: 'c-fuel', wallet_id: 'w-bca' }),
  tx('t3', 'Grab', 42000, 'expense', 'approved', 1, { category_id: 'c-transport' }),
  tx('t4', 'PLN Pascabayar', 612450, 'expense', 'approved', 2, { category_id: 'c-bills', wallet_id: 'w-bca' }),
  tx('t5', 'Gaji November', 14500000, 'income', 'approved', 3, { wallet_id: 'w-bca' }),
  tx('t6', 'Tokopedia', 1289000, 'expense', 'approved', 4, { category_id: 'c-shop', wallet_id: 'w-bca', is_reimbursement: true, reimbursement_status: 'receivable' }),
  tx('t7', 'Top Up GoPay', 300000, 'transfer', 'approved', 5, { wallet_id: 'w-bca', destination_wallet_id: 'w-gopay', category_id: null }),
  tx('t8', 'Sate Khas Senayan', 186000, 'expense', 'approved', 6),
];

const CASHFLOW = Array.from({ length: 14 }, (_, i) => ({
  day: iso(13 - i).slice(0, 10),
  income: i === 10 ? 14500000 : i === 4 ? 1500000 : 0,
  expense: 120000 + ((i * 97) % 7) * 85000,
  basis: 'approved',
}));

const SPENDING = [
  { id: 'c-shop', name: 'Belanja', amount: 2145000, basis: 'approved' },
  { id: 'c-food', name: 'Makan & Minum', amount: 1687500, basis: 'approved' },
  { id: 'c-bills', name: 'Tagihan', amount: 612450, basis: 'approved' },
  { id: 'c-transport', name: 'Transportasi', amount: 534000, basis: 'approved' },
];

const BUDGET = {
  period,
  total_income_planned: 14500000,
  total_allocated: 6500000,
  category_spent: { 'c-food': 1687500, 'c-transport': 534000, 'c-bills': 612450, 'c-shop': 2145000 },
  allocations: [
    { id: 'a1', category_id: 'c-food', category_name: 'Makan & Minum', allocated_amount: 2500000, spent_amount: 1687500 },
    { id: 'a2', category_id: 'c-transport', category_name: 'Transportasi', allocated_amount: 1000000, spent_amount: 534000 },
    { id: 'a3', category_id: 'c-bills', category_name: 'Tagihan', allocated_amount: 1000000, spent_amount: 612450 },
    { id: 'a4', category_id: 'c-shop', category_name: 'Belanja', allocated_amount: 2000000, spent_amount: 2145000 },
  ],
};

const SUMMARY = {
  period: { from: iso(30).slice(0, 10), to: iso(0).slice(0, 10) },
  basis: 'approved',
  income: 16000000,
  expense: 4978950,
  transfer: 300000,
  net_cashflow: 11021050,
  inbox: { basis: 'needs_review', count: INBOX.length, amount: 1664500 },
  forecast: { basis: 'approved+pending', income: 17500000, expense: 5143450 },
};

/** many: a 120-row ledger served with real page/page_size slicing, for infinite-scroll specs. */
const MANY_LEDGER = Array.from({ length: 120 }, (_, i) =>
  tx(`m${i}`, `Belanja ${i + 1}`, 10000 + i * 500, 'expense', 'approved', Math.floor(i / 6)),
);

export type MockOptions = { empty?: boolean; many?: boolean };

export function fixtureFor(path: string, search: URLSearchParams, opts: MockOptions = {}): unknown {
  const empty = Boolean(opts.empty);
  if (path === '/me') return ME;
  if (path === '/readyz') return { status: 'ok', database: 'ok' };
  if (path === '/push/config') return { enabled: false, public_key: '' };
  if (path === '/wallets') return empty ? [] : WALLETS;
  if (path === '/analytics/wallet-balances') return empty ? [] : BALANCES;
  if (path === '/categories') return CATEGORIES;
  if (path === '/inbox/transactions') return empty ? [] : INBOX;
  if (path === '/transactions') {
    const all = empty ? [] : opts.many ? MANY_LEDGER : LEDGER;
    const page = Number(search.get('page') ?? 1);
    const size = Number(search.get('page_size') ?? 50);
    const data = all.slice((page - 1) * size, page * size);
    return { data, pagination: { page, page_size: size, total: all.length, total_pages: Math.max(1, Math.ceil(all.length / size)) } };
  }
  if (path === '/analytics/summary') return SUMMARY;
  if (path === '/analytics/cashflow') return empty ? [] : CASHFLOW;
  if (path === '/analytics/spending-by-category') return empty ? [] : SPENDING;
  if (path === '/analytics/spending-by-tags') return [];
  if (path === '/analytics/reimbursements') {
    const items = empty ? [] : LEDGER.filter((t) => t.is_reimbursement);
    return { basis: 'approved', items, total_receivable: empty ? 0 : 1289000, total_reimbursed: 0 };
  }
  if (path === '/reimbursements') return empty ? [] : LEDGER.filter((t) => t.is_reimbursement);
  if (path === '/budgets') return empty ? null : BUDGET;
  return [];
}

export async function mockApi(page: Page, opts: MockOptions = {}) {
  await page.route('**/api/backend/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/backend', '');
    const body = route.request().method() === 'GET' ? fixtureFor(path, url.searchParams, opts) : { status: 'ok' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}
