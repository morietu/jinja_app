// apps/web/src/app/mypage/tests/tabs.test.ts
import { describe, it, expect } from "vitest";
import { TABS, sanitizeTab } from "../tabs";

describe("sanitizeTab", () => {
  it("returns 'profile' when undefined/null", () => {
    expect(sanitizeTab(undefined)).toBe("profile");
    expect(sanitizeTab(null as any)).toBe("profile");
  });

  it("passes through allowed tabs", () => {
    for (const t of TABS) expect(sanitizeTab(t)).toBe(t);
  });

  it("guards unknown values to 'profile'", () => {
    expect(sanitizeTab("unknown" as any)).toBe("profile");
  });
});
