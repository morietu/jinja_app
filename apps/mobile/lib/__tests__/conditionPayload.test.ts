import { describe, expect, it } from "vitest";
import type { UserProfile } from "../../types/profile";
import { buildConditionFilters, buildConditionProfileContext } from "../conditionPayload";

describe("conditionPayload visit style authority", () => {
  it("keeps the current visit preference as structured visit_style_tags", () => {
    const condition = {
      birthdate: "1984-05-15",
      visitStyleLabel: "静かに整えたい",
    };

    expect(buildConditionFilters(condition).visit_style_tags).toEqual(["quiet"]);

    const context = buildConditionProfileContext({ condition, globalUserProfile: {} });
    expect(context.user_profile.visit_style_tags).toEqual(["quiet"]);
    expect(context.user_profile).not.toHaveProperty("worshipStyle");
  });

  it("ignores a legacy persisted worshipStyle instead of falling back to it", () => {
    const legacyProfile = {
      birthday: "1984-05-15",
      birthTime: "05:25",
      birthPlace: "東京都",
      worshipStyle: "朝参り",
    } as UserProfile & { worshipStyle: string };

    const context = buildConditionProfileContext({
      condition: {},
      globalUserProfile: legacyProfile,
    });

    expect(context.user_profile).toMatchObject({
      birthday: "1984-05-15",
      birthTime: "05:25",
      birthPlace: "東京都",
    });
    expect(context.user_profile.visit_style_tags).toBeUndefined();
    expect(context.user_profile).not.toHaveProperty("worshipStyle");
  });
});
