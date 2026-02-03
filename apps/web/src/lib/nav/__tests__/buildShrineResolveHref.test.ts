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

    expect(href).toContain("place_id=pid");
    expect(href).not.toContain("a=");
    expect(href).not.toContain("b=");
    expect(href).not.toContain("c=");
    expect(href).not.toContain("d=");
    expect(href).toContain("n=0");
    // ※この関数は boolean を 1/0 にしない。String(true/false) なので "true"/"false"
    expect(href).toContain("t=true");
    expect(href).toContain("f=false");
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

