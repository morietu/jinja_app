import { describe, it, expect } from "vitest";
import type { Favorite } from "@/lib/api/favorites";
import { normalizeFavorite, favoriteKey, dedupeFavorites } from "../normalize";

describe("normalizeFavorite", () => {
  it("shrine_id を優先して shrineId を返す", () => {
    const f: Favorite = { id: 1, shrine_id: 5 };
    expect(normalizeFavorite(f)).toEqual({ shrineId: 5, placeId: null });
  });

  it("target_type=shrine の target_id を shrineId として扱う", () => {
    const f: Favorite = { id: 2, target_type: "shrine", target_id: 9 };
    expect(normalizeFavorite(f)).toEqual({ shrineId: 9, placeId: null });
  });

  it("place_id を placeId として扱う", () => {
    const f: Favorite = { id: 3, place_id: "abc" };
    expect(normalizeFavorite(f)).toEqual({ shrineId: null, placeId: "abc" });
  });
});

describe("favoriteKey", () => {
  it("shrine の場合 shrine:ID を返す", () => {
    const f: Favorite = { id: 10, shrine_id: 7 };
    expect(favoriteKey(f)).toBe("shrine:7");
  });

  it("place の場合 place:ID を返す", () => {
    const f: Favorite = { id: 11, place_id: "xyz" };
    expect(favoriteKey(f)).toBe("place:xyz");
  });
});

describe("dedupeFavorites", () => {
  it("同じ shrineId の重複を除去する", () => {
    const list: Favorite[] = [
      { id: 1, shrine_id: 5 },
      { id: 2, target_type: "shrine", target_id: 5 },
      { id: 3, shrine_id: 6 },
    ];

    const out = dedupeFavorites(list);
    expect(out).toHaveLength(2);
    expect(out.map((f) => f.id)).toContain(1);
    expect(out.map((f) => f.id)).toContain(3);
  });
});
