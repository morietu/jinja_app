import { test, expect } from "@playwright/test";

test("ランキング：タブ表示と人気タブの読み込み", async ({ page }) => {
  await page.goto("/ranking");
  await expect(
    page.getByRole("heading", { level: 1, name: "人気神社ランキング" })
  ).toBeVisible();

  // 月間が初期選択
  await expect(page.getByText("月間TOP10")).toBeVisible();
  await expect(page.getByRole("list")).toBeVisible();

  // 年間に切替
  await page.getByRole("tab", { name: "年間TOP10" }).click();
  await expect(page.getByRole("list")).toBeVisible();

  // 人気（近く／ページング）に切替
  await page.getByRole("tab", { name: "人気（近く／ページング）" }).click();
  // 近傍ボタン or 近傍表示中のどちらかが出る
  await expect(page.getByText(/近くを表示|近傍表示中/)).toBeVisible();
});
