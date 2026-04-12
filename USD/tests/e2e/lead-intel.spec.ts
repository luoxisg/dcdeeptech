import { test, expect } from "@playwright/test";

test("search to detail to export flow", async ({ page }) => {
  await page.goto("http://localhost:3002/search");
  await page.getByRole("button", { name: "Run search" }).click();
  await expect(page).toHaveURL(/\/leads/);
  await page.getByRole("link", { name: /Open/i }).first().click();
  await expect(page).toHaveURL(/\/leads\//);
  await page.goto("http://localhost:3002/export");
  await page.getByRole("button", { name: "Generate export" }).click();
  await expect(page.getByText(/No export generated yet|company_id/)).toBeVisible();
});
