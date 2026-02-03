import { describe, it, expect } from "vitest";
import { buildShrineResolveHref } from "../buildShrineResolveHref";

describe("buildShrineResolveHref", () => {
  it("基本: place_id だけを付ける", () => {
    expect(buildShrineResolveHref("pid")).toBe("/shrines/resolve?place_id=pid");
  });

  it("ctx と tid を付ける（ctxはmap/concierge）", () => {
    const href = buildShrineResolveHref("pid", { ctx: "map", tid: "t1" });
    expect(href).toContain("/shrines/resolve?");
    expect(href).toContain("place_id=pid");
    expect(href).toContain("ctx=map");
    expect(href).toContain("tid=t1");
  });

  it("query の null/undefined/空白は無視される。boolean/numberは文字列化される", () => {
    const href = buildShrineResolveHref("pid", {
      query: { a: "", b: "   ", c: null, d: undefined, n: 0, t: true, f: false },
    });

    const url = new URL(href, "http://localhost");
    const p = url.searchParams;

    expect(url.pathname).toBe("/shrines/resolve");

    // 必須
    expect(p.get("place_id")).toBe("pid");

    // 無視される
    expect(p.has("a")).toBe(false);
    expect(p.has("b")).toBe(false);
    expect(p.has("c")).toBe(false);
    expect(p.has("d")).toBe(false);

    // 文字列化
    expect(p.get("n")).toBe("0");
    expect(p.get("t")).toBe("true");
    expect(p.get("f")).toBe("false");
  });

  it("query に place_id/ctx/tid が入っていても、必須パラメータが上書きする", () => {
    const href = buildShrineResolveHref("pid-real", {
      ctx: "concierge",
      tid: "tid-real",
      query: {
        place_id: "pid-fake",
        ctx: "map",
        tid: "tid-fake",
        extra: "x",
      },
    });

    expect(href).toContain("extra=x");
    expect(href).toContain("place_id=pid-real");
    expect(href).toContain("ctx=concierge");
    expect(href).toContain("tid=tid-real");
    expect(href).not.toContain("place_id=pid-fake");
    expect(href).not.toContain("ctx=map");
    expect(href).not.toContain("tid=tid-fake");
  });

  it("ctx=null は付与されない。tid は空白なら付与されない", () => {
    const href = buildShrineResolveHref("pid", { ctx: null, tid: "   " });
    expect(href).toBe("/shrines/resolve?place_id=pid");
  });
});
