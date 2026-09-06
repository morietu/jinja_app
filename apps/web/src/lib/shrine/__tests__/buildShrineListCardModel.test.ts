import { describe, expect, it } from "vitest";

import { buildShrineListCardModel } from "@/lib/shrine/buildShrineListCardModel";
import type { Shrine } from "@/lib/api/shrines";

function shrine(overrides: Partial<Shrine> = {}): Shrine {
  return {
    id: 1,
    name_jp: "テスト神社",
    address: "東京都千代田区1-1",
    latitude: 35.0,
    longitude: 139.0,
    goriyaku_tags: [],
    ...overrides,
  } as Shrine;
}

const NOW = new Date("2026-09-14T12:00:00+09:00");

describe("buildShrineListCardModel", () => {
  it("created_atが14日間の表示期間内ならisNew=true", () => {
    const model = buildShrineListCardModel(
      shrine({ created_at: "2026-09-01T10:00:00+09:00" }),
      NOW,
    );

    expect(model.isNew).toBe(true);
  });

  it("created_atが表示期間を過ぎていればisNew=false", () => {
    const model = buildShrineListCardModel(
      shrine({ created_at: "2026-08-31T10:00:00+09:00" }),
      NOW,
    );

    expect(model.isNew).toBe(false);
  });

  it("created_atが無い場合もisNew=falseで、既存のcard propsは維持される", () => {
    const model = buildShrineListCardModel(shrine(), NOW);

    expect(model.isNew).toBe(false);
    expect(model.shrineId).toBe(1);
    expect(model.title).toBe("テスト神社");
    expect(model.address).toBe("東京都千代田区1-1");
    expect(model.rating).toBeNull();
    expect(model.reviewCount).toBeNull();
  });

  it("created_atが不正値でも例外にならずisNew=false", () => {
    expect(() => buildShrineListCardModel(shrine({ created_at: "not-a-date" }), NOW)).not.toThrow();
    expect(buildShrineListCardModel(shrine({ created_at: "not-a-date" }), NOW).isNew).toBe(false);
  });
});
