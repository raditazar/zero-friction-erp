import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

// Self-contained: the API is mocked in-page, so run with E2E_SKIP_STACK=1 (no Docker needed).
const ROUTES = ['/', '/inbox', '/transactions', '/wallets', '/budgets', '/analytics', '/reimbursements', '/planning'];

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

    test('bottom padding clears the dock and safe area', async ({ page }) => {
      const paddingBottom = await page.locator('main').first().evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
      // The dock plus its raised Catat button need at least 88px.
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

test.describe('mobile shell', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.locator('main').first().waitFor();
  });

  test('dock has five slots and reaches the main pages in one tap', async ({ page }) => {
    const dock = page.getByRole('navigation', { name: 'Navigasi utama' });
    await expect(dock.locator(':scope > a, :scope > button, :scope > div button')).toHaveCount(5);
    await dock.getByRole('link', { name: 'Buku Besar' }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await dock.getByRole('link', { name: /Kotak Masuk/ }).click();
    await expect(page).toHaveURL(/\/inbox/);
    await dock.getByRole('link', { name: 'Beranda' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Lainnya lists every other destination and navigates', async ({ page }) => {
    await page.getByRole('button', { name: 'Lainnya' }).click();
    const sheet = page.getByRole('dialog', { name: 'Lainnya' });
    for (const name of ['Dompet', 'Anggaran', 'Analitik', 'Target', 'Berulang', 'Reimburse', 'Kategori', 'Otomasi', 'Pengaturan']) {
      await expect(sheet.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
    }
    await sheet.getByRole('link', { name: /Dompet/ }).click();
    await expect(page).toHaveURL(/\/wallets/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: 'Kembali' })).toBeVisible();
  });

  test('browser back closes an open sheet without leaving the page', async ({ page }) => {
    await page.getByRole('button', { name: 'Catat transaksi' }).click();
    const sheet = page.getByRole('dialog', { name: 'Catat' });
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Catat sheet keeps its submit button visible when the keyboard shrinks the viewport', async ({ page }) => {
    await page.getByRole('button', { name: 'Catat transaksi' }).click();
    const sheet = page.getByRole('dialog', { name: 'Catat' });
    await sheet.getByRole('tab', { name: 'Manual' }).click();
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.55) });
    const submit = sheet.getByRole('button', { name: 'Simpan transaksi' });
    await expect(submit).toBeInViewport({ ratio: 1 });
  });

  test('inputs are at least 16px and no visible text is under 12px', async ({ page }) => {
    await page.getByRole('button', { name: 'Catat transaksi' }).click();
    await page.getByRole('dialog', { name: 'Catat' }).getByRole('tab', { name: 'Manual' }).click();
    const report = await page.evaluate(() => {
      const smallInputs: string[] = [];
      document.querySelectorAll<HTMLElement>('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([hidden]), select, textarea').forEach((el) => {
        if (el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16) smallInputs.push(el.outerHTML.slice(0, 80));
      });
      const smallText: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent || !node.textContent?.trim() || !parent.getClientRects().length) continue;
        if (parseFloat(getComputedStyle(parent).fontSize) < 12) smallText.push(node.textContent.trim().slice(0, 40));
      }
      return { smallInputs, smallText };
    });
    expect(report.smallInputs).toEqual([]);
    expect(report.smallText).toEqual([]);
  });
});

// Icons come from lucide or our own SVGs; emoji and typographic arrows render inconsistently across platforms.
const GLYPHS = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}]/u;

for (const empty of [false, true]) {
  test(`no emoji or typographic arrows in the DOM${empty ? ' (empty data)' : ''}`, async ({ page }) => {
    test.setTimeout(60_000); // walks nine routes
    await mockApi(page, { empty });
    const found: string[] = [];
    for (const route of [...ROUTES, '/recurring', '/taxonomy', '/automation', '/settings']) {
      await page.goto(route);
      await page.locator('main').first().waitFor();
      await page.waitForTimeout(300);
      const text = await page.evaluate(() => document.body.innerText);
      const match = text.match(new RegExp(GLYPHS.source, 'gu'));
      if (match) found.push(`${route}: ${[...new Set(match)].join(' ')}`);
    }
    expect(found).toEqual([]);
  });
}

test.describe('home', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.locator('[data-inbox-card]').waitFor();
  });

  const writes = (page: import('@playwright/test').Page) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET' && request.url().includes('/api/backend/')) calls.push(new URL(request.url()).pathname);
    });
    return calls;
  };

  test('swiping the top inbox card approves it after the undo window', async ({ page }) => {
    const calls = writes(page);
    const card = page.locator('[data-inbox-card]');
    await expect(card).toHaveAttribute('data-inbox-card', 'i1');
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Urungkan' })).toBeVisible();
    await expect(card).toHaveAttribute('data-inbox-card', 'i2');
    expect(calls).toEqual([]);
    await expect.poll(() => calls.length, { timeout: 9000 }).toBe(1);
    expect(calls[0]).toContain('i1');
  });

  test('Urungkan brings the card back and sends nothing', async ({ page }) => {
    const calls = writes(page);
    await page.getByRole('button', { name: 'Setujui', exact: true }).click();
    await expect(page.locator('[data-inbox-card]')).toHaveAttribute('data-inbox-card', 'i2');
    await page.getByRole('button', { name: 'Urungkan' }).click();
    await expect(page.locator('[data-inbox-card]')).toHaveAttribute('data-inbox-card', 'i1');
    await page.waitForTimeout(6000);
    expect(calls).toEqual([]);
  });

  test('a wallet card opens that wallet on the wallets page', async ({ page }) => {
    await page.getByRole('button', { name: /BCA Utama/ }).first().click();
    await expect(page).toHaveURL(/\/wallets/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('BCA Utama');
  });
});

test('3D idle loop runs while visible and pauses off screen', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zfe-3d', 'on');
    window.__zfe3dFrames = 0;
  });
  await mockApi(page);
  await page.goto('/');
  await page.locator('[data-3d="3d"] canvas').first().waitFor({ timeout: 15000 });
  const frames = () => page.evaluate(() => window.__zfe3dFrames ?? 0);
  await expect.poll(frames, { timeout: 5000 }).toBeGreaterThan(10);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const before = await frames();
  await page.waitForTimeout(1000);
  expect((await frames()) - before).toBeLessThanOrEqual(2);
});

test.describe('inbox', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/inbox');
    await page.getByRole('button', { name: /Kopi Kenangan/ }).waitFor();
  });

  test('swiping a row left rejects it after the undo window', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET' && request.url().includes('/api/backend/')) calls.push(new URL(request.url()).pathname);
    });
    const row = page.getByRole('button', { name: /Kopi Kenangan/ });
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Urungkan' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Kopi Kenangan/ })).toHaveCount(0);
    expect(calls).toEqual([]);
    await expect.poll(() => calls.length, { timeout: 9000 }).toBe(1);
    expect(calls[0]).toMatch(/i1.*reject|reject.*i1/);
  });

  test('tapping a row opens its detail as a sheet with the actions', async ({ page }) => {
    await page.getByRole('button', { name: /Indomaret Sudirman/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Indomaret Sudirman');
    await expect(sheet.getByRole('button', { name: 'Setujui' })).toBeInViewport();
    await sheet.getByRole('button', { name: 'Setujui' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: 'Urungkan' })).toBeVisible();
  });

  test('Catat in the header opens the Catat sheet on the photo mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Catat', exact: true }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Catat' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('tab', { name: 'Foto' })).toHaveAttribute('aria-selected', 'true');
  });

  test('statuses use everyday words, not raw enums', async ({ page }) => {
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).not.toMatch(/needs_review|DEC-\d+|Staging Review/);
    await expect(page.getByText('Perlu dicek').first()).toBeVisible();
  });
});
