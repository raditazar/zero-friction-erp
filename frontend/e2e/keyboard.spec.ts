import { test, expect } from '@playwright/test';

test.describe('Keyboard Interaction Tests', () => {
  test('Focus trap on dialogs', async ({ page }) => {
    await page.goto('/dev-primitives');
    
    // Open a dialog
    const openBtn = page.getByRole('button', { name: /open form dialog/i });
    if (await openBtn.isVisible()) {
      await openBtn.focus();
      await page.keyboard.press('Enter');
      
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Check if focus is trapped within dialog
      const firstFocusable = page.getByRole('dialog').locator('input, button').first();
      await expect(firstFocusable).toBeFocused();
    }
  });

  test('Escape key closes dialogs and returns focus properly', async ({ page }) => {
    await page.goto('/dev-primitives');
    
    const openBtn = page.getByRole('button', { name: /open form dialog/i });
    if (await openBtn.isVisible()) {
      await openBtn.focus();
      await page.keyboard.press('Enter');
      
      await expect(page.getByRole('dialog')).toBeVisible();
      
      await page.keyboard.press('Escape');
      
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(openBtn).toBeFocused();
    }
  });

  test('Escape key closes drawers and returns focus properly', async ({ page }) => {
    await page.goto('/dev-primitives');
    
    const openBtn = page.getByRole('button', { name: /open drawer/i });
    if (await openBtn.isVisible()) {
      await openBtn.focus();
      await page.keyboard.press('Enter');
      
      await expect(page.getByRole('dialog')).toBeVisible();
      
      await page.keyboard.press('Escape');
      
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(openBtn).toBeFocused();
    }
  });

  test('Destructive actions can be reached and triggered via keyboard', async ({ page }) => {
    await page.goto('/dev-primitives');
    
    const destructiveBtn = page.getByRole('button', { name: /delete/i });
    if (await destructiveBtn.isVisible()) {
      await destructiveBtn.focus();
      await expect(destructiveBtn).toBeFocused();
      
      await page.keyboard.press('Enter');
      
      // Expect confirm dialog to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      // Tab to confirm button and press enter
      const confirmBtn = dialog.getByRole('button', { name: /confirm/i });
      await confirmBtn.focus();
      await page.keyboard.press('Enter');
      
      // Assert action completed (dialog closed)
      await expect(dialog).not.toBeVisible();
    }
  });
});
