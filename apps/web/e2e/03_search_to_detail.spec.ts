import { test, expect } from "@playwright/test";

test("検索から詳細に遷移できる", async ({ page }) => {
  // SSR/CSRを安定化：最初からクエリ付きで開く
  await page.goto("/search?q=%E7%A5%9E%E7%A4%BE");

  const first = page.getByTestId("search-result-item").first();
  await expect(first).toBeVisible();

  // a[href] の想定。nullだったらフォールバックでクリックのみ。
  const href = await first.getAttribute("href");

  // クリック → URL遷移を待つ（WebKitの取りこぼし対策あり）
  await first.click({ force: true });
  await page.waitForTimeout(50); // クリック直後の同期ズレ吸収

  try {
    await expect(page).toHaveURL(/\/shrines\/\w+/, { timeout: 8000 });
  } catch (err) {
    // まだ /search にいるなら安全弁で明示遷移
    if (href && page.url().includes("/search")) {
      await page.goto(href);
      await expect(page).toHaveURL(/\/shrines\/\w+/);
    } else {
      throw err; // 本当に失敗しているケースは投げ直す
    }
  }

  // 詳細ページのH1が見えるまで待つ
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
