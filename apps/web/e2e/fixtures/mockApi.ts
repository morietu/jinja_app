import { test as base, expect } from "@playwright/test";

// ← これが無いと "does not provide an export named 'expect'"
export { expect };

export const test = base.extend({
  page: async ({ page }, use) => {
    // 近隣神社モック
    await page.route("**/api/shrines/nearby**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: "s1",
              name: "日枝神社",
              lat: 35.67,
              lng: 139.74,
              distance_m: 120,
            },
            {
              id: "s2",
              name: "赤坂氷川神社",
              lat: 35.66,
              lng: 139.73,
              distance_m: 420,
            },
          ],
        }),
      });
    });

    // 検索モック
    await page.route("**/api/places/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { place_id: "p1", name: "明治神宮", formatted_address: "渋谷区…" },
            {
              place_id: "p2",
              name: "神田明神",
              formatted_address: "千代田区…",
            },
          ],
        }),
      });
    });

    // 詳細モック（必要なら）
    await page.route("**/api/shrines/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "s1",
          name: "日枝神社",
          description: "テストダミー",
        }),
      });
    });

    await use(page);
  },
});
