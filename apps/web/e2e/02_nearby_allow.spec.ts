// 例: e2e/02_nearby_allow.spec.ts
import { test, expect } from "./fixtures/mockApi";

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 35.681236, longitude: 139.767125 },
});

test("現在地ONで近くの神社一覧が出る", async ({ page }) => {
  await page.goto("/nearby");
  // UIが data-testid を持たないなら、ロールやテキストに変えるか、data-testidを実装に足す
  await expect(page.getByText(/日枝神社/)).toBeVisible();
});
