import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';
import type { Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Horizontal swipe with touch pointer events. Mobile WebKit does not turn page.mouse
 * into pointer drags (and has no mouse.wheel), so the gesture is dispatched directly:
 * pointerdown on the element, then moves and pointerup on the window, one per frame.
 */
async function swipe(target: Locator, from: number, to: number) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const y = box.y + box.height / 2;
  await target.evaluate(
    async (el, { startX, endX, y }) => {
      const init = (x: number): PointerEventInit => ({
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      });
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      el.dispatchEvent(new PointerEvent('pointerdown', init(startX)));
      await frame();
      const steps = 12;
      for (let i = 1; i <= steps; i += 1) {
        window.dispatchEvent(new PointerEvent('pointermove', init(startX + ((endX - startX) * i) / steps)));
        await frame();
      }
      window.dispatchEvent(new PointerEvent('pointerup', { ...init(endX), buttons: 0 }));
      await frame();
    },
    { startX: box.x + box.width * from, endX: box.x + box.width * to, y },
  );
}

// Self-contained: the API is mocked in-page, so run with E2E_SKIP_STACK=1 (no Docker needed).
const ROUTES = ['/', '/inbox', '/transactions', '/wallets', '/budgets', '/analytics', '/reimbursements', '/planning'];

// Each page runs twice: light with full motion, and dark with reduced motion, so every rule
// below is checked in both themes and both motion settings without quadrupling the run.
const VARIANTS = [
  { theme: 'light', motion: 'no-preference' },
  { theme: 'dark', motion: 'reduce' },
] as const;

/** Walks visible text and form fields: inputs under 16px zoom iOS, text under 12px is unreadable. */
async function typeScale(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const smallInputs: string[] = [];
    document
      .querySelectorAll<HTMLElement>('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([hidden]), select, textarea')
      .forEach((el) => {
        if (el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16) smallInputs.push(el.outerHTML.slice(0, 80));
      });
    const smallText: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || !parent.getClientRects().length) continue;
      if (parent.closest('.sr-only, [aria-hidden="true"] svg')) continue;
      if (parseFloat(getComputedStyle(parent).fontSize) < 12) smallText.push(node.textContent.trim().slice(0, 40));
    }
    return { smallInputs, smallText: [...new Set(smallText)] };
  });
}

for (const variant of VARIANTS) {
  for (const route of ROUTES) {
    test.describe(`mobile ergonomics ${route} (${variant.theme}, motion ${variant.motion})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ colorScheme: variant.theme, reducedMotion: variant.motion });
        await mockApi(page);
        await page.goto(route);
        await page.locator('main').first().waitFor();
        await expect(page.locator('html')).toHaveAttribute('data-theme', variant.theme);
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

      test('inputs are at least 16px and no visible text is under 12px', async ({ page }) => {
        await page.waitForTimeout(300);
        const report = await typeScale(page);
        expect(report.smallInputs, `Small inputs on ${route}`).toEqual([]);
        expect(report.smallText, `Small text on ${route}`).toEqual([]);
      });

      test('text meets WCAG AA contrast', async ({ page }) => {
        // Let entrance animations settle so axe reads final colours, not mid-fade ones.
        await page.waitForTimeout(variant.motion === 'reduce' ? 300 : 1200);
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        const failures = results.violations.flatMap((violation) =>
          violation.nodes.map((node) => `${node.target.join(' ')}: ${node.any[0]?.message ?? violation.help}`),
        );
        expect(failures, `Low contrast on ${route}`).toEqual([]);
      });

      if (variant.motion === 'reduce') {
        test('reduced motion keeps 3D scenes static', async ({ page }) => {
          const modes = await page.locator('[data-3d]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-3d')));
          expect(modes.filter((mode) => mode !== 'static')).toEqual([]);
        });
      }
    });
  }
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

  for (const sheetCase of [
    { trigger: 'Catat transaksi', dialog: 'Catat' },
    { trigger: 'Lainnya', dialog: 'Lainnya' },
  ]) {
    test(`focus stays inside the ${sheetCase.dialog} sheet and returns to its trigger`, async ({ page, browserName }) => {
      // Mobile WebKit does not move focus with Tab between links and buttons by default.
      test.skip(browserName === 'webkit', 'Tab focus traversal differs in WebKit');
      const trigger = page.getByRole('button', { name: sheetCase.trigger });
      await trigger.click();
      const sheet = page.getByRole('dialog', { name: sheetCase.dialog });
      await expect(sheet).toBeVisible();
      await expect.poll(() => sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press('Tab');
        expect(await sheet.evaluate((node) => node.contains(document.activeElement)), `Tab ${i + 1} left the sheet`).toBe(true);
      }
      await page.keyboard.press('Shift+Tab');
      expect(await sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }

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
    await swipe(card, 0.5, 1.15);
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
    await swipe(row, 0.7, 0.03);
    await expect(page.getByRole('button', { name: 'Urungkan' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Kopi Kenangan/ })).toHaveCount(0);
    expect(calls).toEqual([]);
    await expect.poll(() => calls.length, { timeout: 9000 }).toBe(1);
    expect(calls[0]).toMatch(/i1.*reject|reject.*i1/);
  });

  test('a notification deep link opens that item as a sheet', async ({ page }) => {
    await page.goto('/inbox?id=i2');
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Indomaret Sudirman');
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

test.describe('ledger', () => {
  test('scrolling to the end loads more rows on phones', async ({ page }) => {
    await mockApi(page, { many: true });
    await page.goto('/transactions');
    await page.getByRole('button', { name: /Belanja 1\b/ }).waitFor();
    await expect(page.getByRole('button', { name: /Belanja 60\b/ })).toHaveCount(0);
    await page.getByText('Memuat lagi').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: /Belanja 60\b/ })).toHaveCount(1, { timeout: 8000 });
    await expect(page.getByRole('button', { name: /Halaman|Berikutnya/ })).toHaveCount(0);
  });

  test('search and filter chips stay pinned while scrolling', async ({ page }) => {
    await mockApi(page, { many: true });
    await page.goto('/transactions');
    await page.getByRole('button', { name: /Belanja 1\b/ }).waitFor();
    await page.evaluate(() => window.scrollBy(0, 2500));
    await page.waitForTimeout(400);
    await expect(page.getByPlaceholder('Cari merchant atau catatan...').first()).toBeInViewport();
  });
});

test.describe('wallets', () => {
  test('wallet cards are real buttons that open the detail sheet from the keyboard', async ({ page }) => {
    await mockApi(page);
    await page.goto('/wallets');
    const card = page.getByRole('button', { name: /GoPay/ }).last();
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('GoPay');
  });

  test('3D card fan renders and a tap opens that wallet', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('zfe-3d', 'on'));
    await mockApi(page);
    await page.goto('/wallets');
    const canvas = page.locator('[data-3d="3d"] canvas').first();
    await canvas.waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('budgets', () => {
  test('category bars are labelled progress bars and the hero swipes to the previous month', async ({ page }) => {
    const periods: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/budgets')) periods.push(url.searchParams.get('period') ?? '');
    });
    await mockApi(page);
    await page.goto('/budgets');
    const hero = page.getByRole('region', { name: 'Sisa anggaran' });
    await hero.waitFor();
    await expect(page.getByRole('progressbar').first()).toHaveAttribute('aria-label', /terpakai/);
    const before = periods.at(-1);
    await swipe(hero, 0.1, 0.65);
    await expect.poll(() => periods.at(-1)).not.toBe(before);
  });
});

test.describe('planning', () => {
  test('saving a goal does not reload the page and closes the sheet', async ({ page }) => {
    await mockApi(page);
    await page.goto('/planning');
    await page.getByRole('button', { name: 'Tambah target' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Nama').fill('Dana darurat');
    await sheet.getByLabel('Target').fill('5000000');
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    await sheet.getByRole('button', { name: 'Tambah target' }).click();
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
  });
});

/** Vertical touch drag from the given point, dispatched as TouchEvents (one move per frame). */
async function touchDrag(page: import('@playwright/test').Page, x: number, fromY: number, toY: number) {
  await page.evaluate(
    async ({ x, fromY, toY }) => {
      const target = document.elementFromPoint(x, fromY) ?? document.body;
      const touch = (y: number) => new Touch({ identifier: 3, target, clientX: x, clientY: y });
      const fire = (type: string, y: number, active: boolean) =>
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: active ? [touch(y)] : [],
            targetTouches: active ? [touch(y)] : [],
            changedTouches: [touch(y)],
          }),
        );
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      fire('touchstart', fromY, true);
      await frame();
      for (let i = 1; i <= 14; i += 1) {
        fire('touchmove', fromY + ((toY - fromY) * i) / 14, true);
        await frame();
      }
      fire('touchend', toY, false);
    },
    { x, fromY, toY },
  );
}

test.describe('pull to refresh', () => {
  test('pulling down from the top refetches the page data', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit has no Touch constructor for synthetic touch events');
    await mockApi(page);
    // The ledger has no 3D canvas at the top (canvases keep their own drags).
    await page.goto('/transactions');
    await page.getByRole('heading', { name: 'Buku Besar' }).first().waitFor();
    await page.waitForLoadState('networkidle');
    let fetches = 0;
    page.on('request', (request) => {
      if (request.method() === 'GET' && request.url().includes('/api/backend/')) fetches += 1;
    });
    // A short pull springs back without refreshing.
    await touchDrag(page, 200, 220, 280);
    await expect(page.locator('[data-pull-indicator]')).toHaveAttribute('data-pull-indicator', 'idle');
    await page.waitForTimeout(300);
    expect(fetches).toBe(0);
    // A long pull refreshes.
    await touchDrag(page, 200, 220, 520);
    await expect.poll(() => fetches, { timeout: 5000 }).toBeGreaterThan(0);
    await expect(page.locator('[data-pull-indicator]')).toHaveAttribute('data-pull-indicator', 'idle');
    await expect(page.getByRole('heading', { name: 'Buku Besar' }).first()).toBeVisible();
  });

  test('a pull is ignored while a sheet is open', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit has no Touch constructor for synthetic touch events');
    await mockApi(page);
    await page.goto('/wallets');
    await page.getByRole('button', { name: /BCA Utama/ }).first().waitFor();
    await page.getByRole('button', { name: 'Lainnya' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await touchDrag(page, 200, 300, 600);
    await expect(page.locator('[data-pull-indicator]')).toHaveAttribute('data-pull-indicator', 'idle');
  });
});
