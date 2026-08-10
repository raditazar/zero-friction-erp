import { expect, test } from "@playwright/test";

const categories = [
  { id: "food", name: "Makan", type: "expense" },
  { id: "transport", name: "Transport", type: "expense" },
  { id: "donor", name: "Belanja", type: "expense" },
];

test.describe("monthly budgets", () => {
  test("navigates month, copies allocation, saves allocation, and shifts funds atomically", async ({ page }) => {
    let copied = false;
    let donorAllocation = 100_000;
    let foodAllocation = 5_000;
    let transportAllocation = 0;

    await page.route("**/api/backend/categories", async (route) => {
      await route.fulfill({ json: categories });
    });
    await page.route("**/api/backend/budgets?period=*", async (route) => {
      if (!copied) {
        await route.fulfill({ status: 404, json: { error: "budget not found" } });
        return;
      }
      await route.fulfill({
        json: {
          period: "2026-08",
          allocations: [
            { category_id: "donor", allocated_amount: donorAllocation, spent_amount: 0 },
            { category_id: "food", allocated_amount: foodAllocation, spent_amount: 10_000 },
            { category_id: "transport", allocated_amount: transportAllocation, spent_amount: 0 },
          ],
        },
      });
    });
    await page.route("**/api/backend/budgets/copy-previous", async (route) => {
      copied = true;
      await route.fulfill({ json: { status: "success" } });
    });
    await page.route("**/api/backend/budgets/allocations", async (route) => {
      const body = route.request().postDataJSON() as { allocations: Array<{ category_id: string; allocated_amount: number }> };
      transportAllocation = body.allocations[0].allocated_amount;
      await route.fulfill({ json: { status: "success" } });
    });
    await page.route("**/api/backend/budgets/shift", async (route) => {
      const body = route.request().postDataJSON() as { source_category_id: string; target_category_id: string; amount: number };
      expect(body).toEqual({ period: "2026-08", source_category_id: "donor", target_category_id: "food", amount: 5_000 });
      donorAllocation -= body.amount;
      foodAllocation += body.amount;
      await route.fulfill({ json: { status: "success" } });
    });

    await page.goto("/budgets?period=2026-08");
    await expect(page.getByRole("heading", { name: "Anggaran Bulanan" })).toBeVisible();

    await page.getByRole("button", { name: "Bulan berikutnya" }).click();
    await expect(page).toHaveURL(/period=2026-09/);
    await page.goto("/budgets?period=2026-08");

    await page.getByRole("button", { name: "Salin Alokasi Bulan Lalu" }).click();
    await expect(page.getByText("Defisit Rp5.000")).toBeVisible();

    await page.getByRole("button", { name: /Edit Target/ }).filter({ hasText: "Edit Target" }).last().click();
    await page.getByLabel("Target Budget (Rp)").fill("25000");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect.poll(() => transportAllocation).toBe(25_000);

    await page.getByRole("button", { name: /Tutup Defisit/ }).click();
    await expect(page.getByRole("dialog", { name: /Tutup Defisit Makan/ })).toBeVisible();
    await page.getByLabel("Nominal Yang Digeser (Rp)").fill("5000");
    await page.getByRole("button", { name: "Lanjutkan" }).click();
    await expect(page.getByRole("dialog", { name: "Konfirmasi Geser Anggaran" })).toBeVisible();
    await expect(page.getByText("Sisa Belanja (Donor)")).toBeVisible();
    await page.getByRole("button", { name: "Eksekusi Shift Budget" }).click();
    await expect(page.getByText("Sisa Rp0")).toBeVisible();
  });
});
