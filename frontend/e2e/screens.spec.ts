import path from 'path';
import { test } from '@playwright/test';
import { mockApi } from './mock-api';

/**
 * Visual review helper, not an assertion suite. Opt in with SCREENSHOT_DIR:
 *   SCREENSHOT_DIR=/abs/dir E2E_SKIP_STACK=1 npx playwright test screens.spec.ts --project=pixel
 * Optional SCREENS="/,/inbox" limits the routes. SCREEN_EMPTY=1 captures the empty states
 * (files get an "-empty" suffix). SCREEN_3D=1 forces the WebGL coin stack on weak hosts.
 */
const outDir = process.env.SCREENSHOT_DIR;
test.skip(!outDir, 'set SCREENSHOT_DIR to capture review screenshots');

const ALL = ['/', '/inbox', '/transactions', '/wallets', '/budgets', '/analytics', '/reimbursements', '/planning', '/recurring', '/taxonomy', '/automation', '/settings'];
const routes = process.env.SCREENS ? process.env.SCREENS.split(',') : ALL;
const themes = (process.env.SCREEN_THEMES ?? 'light,dark').split(',');
const empty = process.env.SCREEN_EMPTY === '1';
const suffix = empty ? '-empty' : '';
const force3d = process.env.SCREEN_3D === '1';

for (const theme of themes) {
  test(`screenshot ${theme} sheets`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('zfe-theme', value), theme);
    await mockApi(page);
    await page.goto('/');
    await page.locator('main').first().waitFor();
    await page.getByRole('button', { name: 'Lainnya' }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir as string, `${theme}-sheet-lainnya.png`) });
    await page.keyboard.press('Escape');
    for (const mode of ['Foto', 'Teks', 'Manual']) {
      await page.getByRole('button', { name: 'Catat transaksi' }).click();
      await page.getByRole('dialog', { name: 'Catat' }).getByRole('tab', { name: mode }).click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(outDir as string, `${theme}-sheet-catat-${mode.toLowerCase()}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  });

  for (const route of routes) {
    test(`screenshot ${theme} ${route}`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('zfe-theme', value), theme);
      if (force3d) await page.addInitScript(() => localStorage.setItem('zfe-3d', 'on'));
      await mockApi(page, { empty });
      await page.goto(route);
      await page.locator('main').first().waitFor();
      await page.waitForTimeout(Number(process.env.SCREEN_WAIT ?? (force3d ? 2500 : 1400)));
      const name = `${theme}-${route === '/' ? 'home' : route.slice(1).replace(/\//g, '-')}${suffix}.png`;
      await page.screenshot({ path: path.join(outDir as string, name), fullPage: process.env.SCREEN_FULL === '1' });
    });
  }

  test(`screenshot ${theme} login`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('zfe-theme', value), theme);
    if (force3d) await page.addInitScript(() => localStorage.setItem('zfe-3d', 'on'));
    await page.route('**/api/backend/**', async (route) => {
      const signedOut = !route.request().url().endsWith('/readyz');
      await route.fulfill({
        status: signedOut ? 401 : 200,
        contentType: 'application/json',
        body: JSON.stringify(signedOut ? { error: 'Unauthorized' } : { status: 'ok', database: 'ok' }),
      });
    });
    await page.goto('/login');
    await page.getByRole('link', { name: 'Lanjutkan dengan Google' }).waitFor();
    await page.waitForTimeout(Number(process.env.SCREEN_WAIT ?? (force3d ? 2500 : 1400)));
    await page.screenshot({ path: path.join(outDir as string, `${theme}-login.png`) });
  });
}
