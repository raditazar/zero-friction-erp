import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Routes available to an authenticated finance operator in the first release. */
export const phaseOneRoutes = [
  { path: "/", heading: "Ringkasan" },
  { path: "/inbox", heading: "Inbox|Kotak Masuk" },
  { path: "/transactions", heading: "Transaksi|Buku Besar" },
  { path: "/analytics", heading: "Analitik|Laporan" },
  { path: "/wallets", heading: "Dompet" },
  { path: "/budgets", heading: "Anggaran" },
  { path: "/reimbursements", heading: "Reimbursement|Reimburse" },
  { path: "/planning", heading: "Perencanaan|Target" },
  { path: "/integrations", heading: "Vault" },
  { path: "/automation", heading: "Otomatisasi|Webhook" },
  { path: "/taxonomy", heading: "Taksonomi|Kategori" },
  { path: "/recurring", heading: "Berulang" },
  { path: "/guide", heading: "Panduan" },
  { path: "/settings", heading: "Pengaturan" },
] as const;

/** The E2E session is supplied by Playwright's storageState setup. */
export async function installExternalServiceGuards(page: Page) {
  await page.route(/https?:\/\/.*(?:generativelanguage\.googleapis\.com|gemini\.google\.com).*/i, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
}

export function capturePageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations, results.violations.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`).join("\n")).toEqual([]);
}
