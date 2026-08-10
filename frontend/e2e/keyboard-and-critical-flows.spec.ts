import { expect, test } from "@playwright/test";
import { capturePageErrors, expectNoAxeViolations, installExternalServiceGuards } from "./helpers";

test.describe("keyboard behavior and critical operator flows", () => {
  test.beforeEach(async ({ page }) => {
    await installExternalServiceGuards(page);
  });

  test("mobile drawer closes with Escape and restores focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Buka navigasi" });
    await trigger.focus();
    await trigger.press("Enter");
    await expect(page.getByRole("dialog", { name: /navigasi utama/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /navigasi utama/i })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("wallet transfer reviews and can be dismissed with Escape", async ({ page }) => {
    const errors = capturePageErrors(page);
    await page.goto("/wallets");
    const start = page.getByRole("button", { name: /transfer antar dompet/i }).first();
    await expect(start).toBeVisible();
    await start.click();
    const transferDialog = page.getByRole("dialog", { name: "Transfer Antar Dompet" });
    await expect(transferDialog).toBeVisible();
    await transferDialog.getByLabel("Nominal Transfer (Rp)").fill("10000");
    await transferDialog.getByRole("button", { name: "Review Transfer" }).click();
    const review = page.getByRole("dialog", { name: "Review Transfer Antar Dompet" });
    await expect(review).toBeVisible();
    await expect(review.getByRole("table")).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(review).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("transaction transfer review is reachable and keyboard-dismissible", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /transfer antar dompet/i }).click();
    const review = page.getByRole("dialog", { name: "Review Transfer Antar Dompet" });
    await expect(review).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(review).toBeHidden();
  });

  test("API key is revealed once and can be revoked", async ({ page }) => {
    const errors = capturePageErrors(page);
    const name = `playwright-key-${Date.now()}`;
    await page.goto("/integrations");
    expect(page.url()).toContain("/settings");
    const form = page.getByRole("heading", { name: "API key" }).locator("..").locator("..");
    await form.getByLabel("Name").fill(name);
    await form.getByRole("button", { name: "Create API key" }).click();
    const reveal = page.getByRole("dialog", { name: /API key created/i });
    await expect(reveal).toBeVisible();
    await expect(reveal.getByText(/•/)).toBeVisible();
    await reveal.getByRole("button", { name: "Reveal secret" }).click();
    await expect(reveal.getByText(/•/)).toBeHidden();
    await reveal.getByRole("button", { name: "Close" }).click();
    await expect(reveal).toBeHidden();
    const row = page.getByText(name).locator("..");
    await row.getByRole("button", { name: "Revoke" }).click();
    const confirm = page.getByRole("dialog", { name: "Revoke credential?" });
    await expect(confirm).toBeVisible();
    const revoke = confirm.getByRole("button", { name: "Hold to revoke" });
    await revoke.hover();
    await page.mouse.down();
    await page.waitForTimeout(2100);
    await page.mouse.up();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("heading", { name: "Revoked history" }).locator("..").getByText(name)).toBeVisible();
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });

  test("profile preferences form in /settings?tab=profile updates user settings", async ({ page }) => {
    const errors = capturePageErrors(page);
    await page.goto("/settings?tab=profile");
    await expect(page.getByRole("heading", { name: "Informasi Profil Pengguna" })).toBeVisible();

    await page.getByLabel("Nama Lengkap").fill("Playwright Operator");
    await page.getByLabel("Bahasa / Locale").selectOption("en");
    await page.getByLabel("Format Tanggal").selectOption("YYYY-MM-DD");
    await page.getByLabel("Mata Uang Default").selectOption("USD");

    await page.getByRole("button", { name: "Simpan Profil" }).click();
    await expect(page.getByText("Preferensi profil berhasil diperbarui!")).toBeVisible();
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });

  test("user guide stepper supports ArrowLeft and ArrowRight keyboard navigation", async ({ page }) => {
    const errors = capturePageErrors(page);
    await page.goto("/guide");
    expect(page.url()).toContain("/settings");
    await expect(page.getByText("Langkah 1 dari 4")).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Wallet & Rekening" })).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Langkah 2 dari 4")).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Transaksi & Inbox" })).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Langkah 1 dari 4")).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Wallet & Rekening" })).toBeVisible();

    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });
});
