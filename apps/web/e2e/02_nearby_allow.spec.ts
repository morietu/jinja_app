// 例: e2e/02_nearby_allow.spec.ts
import { test, expect } from "./fixtures/mockApi";

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 35.681236, longitude: 139.767125 },
});

test("現在地ONで近くの神社一覧が出る", async ({ page, context }) => {
  // 位置情報を許可し、東京駅あたりの座標をセット
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.681236, longitude: 139.767125 });

  await page.goto("/nearby");

  // data-testid があるならこちらを優先
  // なければフォールバックで文言
  await expect(page.getByText(/日枝神社/)).toBeVisible();
});
