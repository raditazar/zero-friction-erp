import { test, expect } from '@playwright/test';

const routes = [
  '/login',
  '/dashboard',
  '/inbox',
  '/transactions',
  '/reports',
  '/wallets',
  '/budgets',
  '/reimbursements',
  '/planning',
  '/taxonomy',
  '/recurring',
  '/automation',
  '/integrations',
  '/guide',
  '/settings'
];

for (const route of routes) {
  test(`Smoke test for ${route}`, async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', exception => {
      errors.push(exception);
    });

    await page.goto(route);

    // Assert no page errors
    expect(errors).toHaveLength(0);

    // Assert main heading exists
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible();

    // Assert no horizontal overflow
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  });
}
