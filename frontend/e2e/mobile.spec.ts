import { test, expect, type Page } from '@playwright/test';

// Self-contained: the API is mocked in-page, so run with E2E_SKIP_STACK=1 (no Docker needed).
const ROUTES = ['/', '/inbox', '/transactions', '/wallets', '/budgets', '/analytics', '/reimbursements', '/planning'];

const ME = { id: 'u1', email: 'tester@example.com', profile: { full_name: 'Tester' } };

async function mockApi(page: Page) {
  await page.route('**/api/backend/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/backend', '');
    let body: unknown = [];
    if (path === '/me') body = ME;
    else if (path === '/readyz') body = { status: 'ok', database: 'ok' };
    else if (path === '/transactions') body = { data: [], total: 0, page: 1, page_size: 20 };
    else if (path.startsWith('/budgets')) body = { period: '2026-11', planned_income: 0, allocations: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

for (const route of ROUTES) {
  test.describe(`mobile ergonomics ${route}`, () => {
    test.beforeEach(async ({ page }) => {
      await mockApi(page);
      await page.goto(route);
      await page.locator('main').first().waitFor();
    });

    test('has no horizontal overflow', async ({ page }) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('bottom padding clears the floating bar and safe area', async ({ page }) => {
      const paddingBottom = await page.locator('main').first().evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
      // 5.5rem = 88px reserved for the floating island bar.
      expect(paddingBottom).toBeGreaterThanOrEqual(88);
    });

    test('visible buttons meet the 44x44 touch target', async ({ page }) => {
      const tooSmall = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>('main button, main a[role="button"], nav button').forEach((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || style.display === 'none') return;
          if (r.width < 43.5 || r.height < 43.5) {
            const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.className.slice(0, 40);
            out.push(`${label} (${Math.round(r.width)}x${Math.round(r.height)})`);
          }
        });
        return out;
      });
      expect(tooSmall, `Undersized targets on ${route}`).toEqual([]);
    });
  });
}
