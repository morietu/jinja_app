import { test, expect } from "@playwright/test";

test("トップが表示される（スモーク）", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/shrine|jinja/i);
  await expect(page.getByRole("navigation")).toBeVisible();
});
