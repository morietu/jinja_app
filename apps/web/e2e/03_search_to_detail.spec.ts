import { test, expect } from "@playwright/test";

test("検索から詳細に遷移できる", async ({ page }) => {
  await page.goto("/search");
  // await page.getByRole("textbox", { name: /検索|search/i }).fill("神社");
  await page.keyboard.press("Enter");
  
  await page.waitForResponse(
    (res) => res.url().includes("/api/places/search") && res.ok()
  );
  const first = page.locator('[data-testid="search-result-item"]').first();
  await expect(first).toBeVisible();
  await first.click();

  await expect(page).toHaveURL(/\/shrines\/\w+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
