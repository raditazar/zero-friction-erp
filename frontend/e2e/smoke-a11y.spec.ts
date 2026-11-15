import { expect, test } from "@playwright/test";
import {
  capturePageErrors,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  installExternalServiceGuards,
  phaseOneRoutes,
} from "./helpers";

test.describe("authenticated phase-one smoke and accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await installExternalServiceGuards(page);
  });

  for (const route of phaseOneRoutes) {
    test(`${route.path} renders accessibly without page errors`, async ({ page }) => {
      const errors = capturePageErrors(page);
      await page.goto(route.path);
      if (route.path === "/integrations" || route.path === "/guide") {
        expect(page.url()).toContain("/settings");
      }
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
      await expect(page.getByRole("heading", { name: new RegExp(route.heading, "i") }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page);
      expect(errors).toEqual([]);
    });
  }

  test("mobile Lainnya sheet reaches the remaining pages and does not overflow", async ({ page }) => {
    const errors = capturePageErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Lainnya" }).click();
    const sheet = page.getByRole("dialog", { name: "Lainnya" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: /Dompet/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });

});
