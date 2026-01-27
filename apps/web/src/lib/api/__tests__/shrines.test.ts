// apps/web/src/lib/api/__tests__/shrines.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getShrines, fetchNearestShrines, getPopularShrines } from "../shrines";

import api from "../client";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("shrines api", () => {
  it("getShrines: 配列をそのまま返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, name_jp: "神社A" }],
      }) as any,
    );

    const res = await getShrines();
    expect(res).toHaveLength(1);
  });

  it("getShrines: results を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: 2, name_jp: "神社B" }] }),
      }) as any,
    );

    const res = await getShrines({ q: "test" });
    expect(res[0].id).toBe(2);
  });

  it("getShrines: ok=false の場合 throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as any,
    );

    await expect(getShrines()).rejects.toThrow();
  });

  it("getPopularShrines: results を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: 1 }] }),
      }) as any,
    );

    const res = await getPopularShrines({});
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe(1);
  });

  it("getPopularShrines: items を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [{ id: 2 }] }),
      }) as any,
    );

    const res = await getPopularShrines({});
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe(2);
  });

  it("fetchNearestShrines: 配列レスポンスを Paginated に変換", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
    } as any);

    const res = await fetchNearestShrines({ lat: 0, lng: 0 });
    expect(res.count).toBe(2);
    expect(res.results).toHaveLength(2);
  });
});
