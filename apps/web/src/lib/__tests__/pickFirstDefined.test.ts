// apps/web/src/lib/__tests__/pickFirstDefined.test.ts
import { describe, it, expect } from "vitest";
// ★ classifyCount を一緒に import する
import { pickFirstDefined, classifyCount } from "../utils";

describe("pickFirstDefined", () => {
  it("a が null/undefined でないときは a を返す", () => {
    expect(pickFirstDefined("first", "second")).toBe("first");
    expect(pickFirstDefined(0, 42)).toBe(0);
  });

  it("a が null/undefined のときは b を返す", () => {
    expect(pickFirstDefined(null as string | null, "fallback")).toBe("fallback");
    expect(pickFirstDefined(undefined as string | undefined, "fallback")).toBe("fallback");
  });
});

describe("classifyCount", () => {
  it("0 のとき 'zero' を返す", () => {
    expect(classifyCount(0)).toBe("zero");
  });

  it("1 のとき 'one' を返す", () => {
    expect(classifyCount(1)).toBe("one");
  });

  it("2 以上のとき 'many' を返す", () => {
    expect(classifyCount(2)).toBe("many");
    expect(classifyCount(10)).toBe("many");
  });
});
