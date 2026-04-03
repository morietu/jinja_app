import { describe, expect, it } from "vitest";
import { resolveTurningPoint } from "@/lib/concierge/turningPoint/resolveTurningPoint";

describe("resolveTurningPoint", () => {
  it("mental は recovery を返す", () => {
    const result = resolveTurningPoint({ primaryNeed: "mental", secondaryNeedTags: [] });
    expect(result.type).toBe("recovery");
  });

  it("career + courage は decision を返す", () => {
    const result = resolveTurningPoint({ primaryNeed: "career", secondaryNeedTags: ["courage"] });
    expect(result.type).toBe("decision");
  });

  it("study は challenge を返す", () => {
    const result = resolveTurningPoint({ primaryNeed: "study", secondaryNeedTags: [] });
    expect(result.type).toBe("challenge");
  });
});
