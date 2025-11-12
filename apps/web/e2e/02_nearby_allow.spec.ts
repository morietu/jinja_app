import { test, expect } from "@playwright/test";

// デフォルトで位置情報を許可＆固定座標（東京駅周辺）
test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 35.681236, longitude: 139.767125 },
});

test("現在地ONで近くの神社一覧が出る", async ({ page }) => {
  // 1) APIスタブを先に登録（末尾スラ有無どちらも拾う）
  await page.route("**/api/shrines/nearest**", async (route) => {
    const payload = {
      count: 3,
      next: null,
      previous: null,
      results: [
        {
          id: 101,
          name_jp: "日枝神社", // 期待値に合わせる
          address: null,
          latitude: 35.68,
          longitude: 139.76,
          distance_m: 120,
        },
        {
          id: 102,
          name_jp: "近隣の神社 2",
          address: null,
          latitude: 35.681,
          longitude: 139.761,
          distance_m: 350,
        },
        {
          id: 103,
          name_jp: "近隣の神社 3",
          address: null,
          latitude: 35.682,
          longitude: 139.762,
          distance_m: 700,
        },
      ],
    };
    await route.fulfill({ status: 200, json: payload });
  });

  // 2) 画面遷移（スタブ登録後に実行）
  await page.goto("/nearby");

  // 3) 検証（data-testid があればそれを優先）
  // await expect(page.getByTestId("nearby-item").first()).toBeVisible();
  await expect(page.getByText(/日枝神社/)).toBeVisible();
});
