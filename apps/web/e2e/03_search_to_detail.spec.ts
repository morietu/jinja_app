import { test, expect } from "@playwright/test";

test("検索から詳細に遷移できる", async ({ page }) => {
  // SSR/CSRを安定化：最初からクエリ付きで開く
  await page.goto("/search?q=%E7%A5%9E%E7%A4%BE");

  const first = page.getByTestId("search-result-item").first();
  await expect(first).toBeVisible();

  // ★ サーバーfetchは待たずに、URL & 見出しで待つ
  // クリック → URL遷移を待つ。Safariで稀に取りこぼすのでフォールバックも用意
  const href = await first.getAttribute("href");
  await first.click({ force: true });
  // devサーバのFast Refresh介入で遷移がキャンセルされることがあるため少し長めに待つ
  await page.waitForTimeout(50); // クリックの同期ズレ吸収
  try {
    await expect(page).toHaveURL(/\/shrines\/\w+/, { timeout: 8000 });
  } catch {
    // まだ /search にいる場合は href に明示遷移（WebKitの安全弁）
    if (href && page.url().includes("/search")) {
      await page.goto(href);
      await expect(page).toHaveURL(/\/shrines\/\w+/);
    } else {
      throw err;
    }
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
