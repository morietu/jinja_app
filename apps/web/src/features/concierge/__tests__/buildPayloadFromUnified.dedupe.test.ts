import { describe, it, expect } from "vitest";
import { __dedupeItemsForTest } from "../buildPayloadFromUnified";

describe("dedupeItems", () => {
  it("shrineId 重複は1件にする（registered優先維持）", () => {
    const out = __dedupeItemsForTest([
      {
        kind: "registered",
        shrineId: 1,
        placeId: "P1",
        title: "A",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
      {
        kind: "registered",
        shrineId: 1,
        placeId: "P1",
        title: "A-dup",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
    ] as any);

    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("registered");
    expect((out[0] as any).shrineId).toBe(1);
  });

  it("placeId 重複は1件にする（place同士）", () => {
    const out = __dedupeItemsForTest([
      {
        kind: "place",
        placeId: "P1",
        detailLabel: "神社の詳細を見る",
        title: "A",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
      {
        kind: "place",
        placeId: "P1",
        detailLabel: "神社の詳細を見る",
        title: "A-dup",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
    ] as any);

    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("place");
    expect((out[0] as any).placeId).toBe("P1");
  });

  it("同じ placeId に registered/place が混在したら registered を残す", () => {
    const out = __dedupeItemsForTest([
      {
        kind: "place",
        placeId: "P1",
        detailLabel: "神社の詳細を見る",
        title: "place",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
      {
        kind: "registered",
        shrineId: 10,
        placeId: "P1",
        title: "registered",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
    ] as any);

    // registered が placeId を確保するので、最終的に registered だけ残る or registered + (順によってはplaceが落ちる)
    expect(out.some((x: any) => x.kind === "registered" && x.shrineId === 10)).toBe(true);
    expect(out.some((x: any) => x.kind === "place" && x.placeId === "P1")).toBe(false);
  });

  it("placeId の trim/lowercase 正規化で重複を潰す", () => {
    const out = __dedupeItemsForTest([
      {
        kind: "place",
        placeId: "  ChIJAbc  ",
        detailLabel: "神社の詳細を見る",
        title: "A",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
      {
        kind: "place",
        placeId: "chijabc",
        detailLabel: "神社の詳細を見る",
        title: "A-dup",
        address: null,
        description: "",
        imageUrl: null,
        breakdown: null,
      },
    ] as any);

    expect(out).toHaveLength(1);
  });
});
