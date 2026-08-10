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
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
      await expect(page.getByRole("heading", { name: new RegExp(route.heading, "i") }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page);
      expect(errors).toEqual([]);
    });
  }

  test("mobile command deck has the same navigation and does not overflow", async ({ page }) => {
    const errors = capturePageErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Buka navigasi" });
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: /navigasi utama/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Dompet" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });
});
