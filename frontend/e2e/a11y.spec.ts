import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = [
  '/',
  '/analytics',
  '/automation',
  '/budgets',
  '/dev-primitives',
  '/guide',
  '/inbox',
  '/integrations',
  '/planning',
  '/recurring',
  '/reimbursements',
  '/settings',
  '/taxonomy',
  '/transactions',
  '/wallets',
];

test.describe('Accessibility Tests', () => {
  for (const route of ROUTES) {
    test(`should not have any automatically detectable accessibility issues on ${route}`, async ({ page }) => {
      await page.goto(route);
      if (route === '/integrations' || route === '/guide') {
        expect(page.url()).toContain('/settings');
      }
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
        
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }

  test('should check invalid form states for accessibility', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
      
    expect(results.violations).toEqual([]);
  });

  test('should check dialogs for accessibility (Confirm)', async ({ page }) => {
    await page.goto('/dev-primitives');
    await page.getByRole('button', { name: /open confirm dialog/i }).click();
    
    // Wait for dialog to appear
    await page.waitForSelector('[role="dialog"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
      
    expect(results.violations).toEqual([]);
  });

  test('should check dialogs for accessibility (Secret Reveal)', async ({ page }) => {
    await page.goto('/dev-primitives');
    await page.getByRole('button', { name: /open secret reveal/i }).click();
    
    await page.waitForSelector('[role="dialog"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
      
    expect(results.violations).toEqual([]);
  });

  test('should check dialogs for accessibility (FormDialog)', async ({ page }) => {
    await page.goto('/dev-primitives');
    await page.getByRole('button', { name: /open form dialog/i }).click();
    
    await page.waitForSelector('[role="dialog"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
      
    expect(results.violations).toEqual([]);
  });
});
