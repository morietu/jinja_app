import { describe, it, expect } from "vitest";
import { buildShrineHref } from "../buildShrineHref";

describe("buildShrineHref", () => {
  it("基本: /shrines/:id（idはencode）", () => {
    expect(buildShrineHref(123)).toBe("/shrines/123");
    expect(buildShrineHref("a b")).toBe("/shrines/a%20b");
  });

  it("ctx/tid をクエリに載せる。tidはnull/undefined/空白は無視", () => {
    expect(buildShrineHref(1, { ctx: "concierge", tid: 99 })).toBe("/shrines/1?ctx=concierge&tid=99");
    expect(buildShrineHref(1, { tid: "   " })).toBe("/shrines/1");
    expect(buildShrineHref(1, { tid: "" })).toBe("/shrines/1");
    expect(buildShrineHref(1, { tid: null })).toBe("/shrines/1");
  });

  it("query: null/undefined/空文字/空白は無視。booleanは1/0", () => {
    const href = buildShrineHref(1, {
      query: { toast: "ok", empty: "", space: "   ", n: 0, t: true, f: false, nu: null, un: undefined },
    });

    expect(href.startsWith("/shrines/1?")).toBe(true);
    expect(href).toContain("toast=ok");
    expect(href).toContain("n=0");
    expect(href).toContain("t=1");
    expect(href).toContain("f=0");
    expect(href).not.toContain("empty=");
    expect(href).not.toContain("space=");
    expect(href).not.toContain("nu=");
    expect(href).not.toContain("un=");
  });

  it("subpath: 先頭スラッシュを除去して付与。空白/nullは無視", () => {
    expect(buildShrineHref(1, { subpath: "goshuins" })).toBe("/shrines/1/goshuins");
    expect(buildShrineHref(1, { subpath: "/goshuins" })).toBe("/shrines/1/goshuins");
    expect(buildShrineHref(1, { subpath: "   " })).toBe("/shrines/1");
    expect(buildShrineHref(1, { subpath: null })).toBe("/shrines/1");
  });

  it("hash: #あり/なし両対応で末尾に付与。空白は無視", () => {
    expect(buildShrineHref(1, { hash: "goshuins" })).toBe("/shrines/1#goshuins");
    expect(buildShrineHref(1, { hash: "#goshuins" })).toBe("/shrines/1#goshuins");
    expect(buildShrineHref(1, { hash: "   " })).toBe("/shrines/1");
  });

  it("全部盛り", () => {
    const href = buildShrineHref("x", {
      ctx: "concierge",
      tid: "42",
      query: { place_id: "abc", toast: true },
      subpath: "/goshuins",
      hash: "#top",
    });

    expect(href).toContain("/shrines/x/goshuins?");
    expect(href).toContain("ctx=concierge");
    expect(href).toContain("tid=42");
    expect(href).toContain("place_id=abc");
    expect(href).toContain("toast=1");
    expect(href.endsWith("#top")).toBe(true);
  });
});
