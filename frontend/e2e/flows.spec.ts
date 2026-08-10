import { test, expect } from '@playwright/test';

test.describe('Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to base URL before tests, assuming auth is handled via global setup if necessary
    await page.goto('/');
  });

  test('Wallet creation, transfer, and balance verification', async ({ page }) => {
    await page.goto('/wallets');

    // Create Wallet
    await page.getByRole('button', { name: /Create Wallet/i }).click();
    await page.getByLabel(/Wallet Name/i).fill('Test Wallet');
    await page.getByRole('button', { name: /Save/i }).click();

    // Verify creation
    await expect(page.getByRole('heading', { name: 'Test Wallet' })).toBeVisible();

    // Transfer
    await page.getByRole('button', { name: /Transfer/i }).click();
    await page.getByLabel(/Amount/i).fill('100');
    await page.getByRole('button', { name: /Confirm/i }).click();

    // Balance verification
    await expect(page.getByText(/100/)).toBeVisible();
  });

  test('Transaction creation and review/approval action', async ({ page }) => {
    await page.goto('/transactions');

    // Create Transaction
    await page.getByRole('button', { name: /New Transaction/i }).click();
    await page.getByLabel(/Amount/i).fill('50');
    await page.getByLabel(/Description/i).fill('Test Transaction');
    await page.getByRole('button', { name: /Submit/i }).click();

    // Review/Approve
    await page.getByRole('button', { name: /Review/i }).first().click();
    await page.getByRole('button', { name: /Approve/i }).click();

    // Verify approval
    await expect(page.getByText(/Approved/i)).toBeVisible();
  });

  test('API key / Webhook Token creation, copying the secret, closing dialog, and revoking via ConfirmDialog', async ({ page }) => {
    await page.goto('/settings');

    // Create API Key
    await page.getByRole('button', { name: /Create API Key/i }).click();
    await page.getByLabel(/Key Name/i).fill('Test Key');
    await page.getByRole('button', { name: /Generate/i }).click();

    // Copy secret
    await page.getByRole('button', { name: /Copy/i }).click();

    // Close dialog
    await page.getByRole('button', { name: /Close/i }).click();

    // Revoke
    await page.getByRole('button', { name: /Revoke/i }).click();
    // Confirm Dialog
    await page.getByRole('button', { name: /Confirm/i }).click();

    // Verify revoked
    await expect(page.getByText(/Test Key/)).not.toBeVisible();
  });
});
