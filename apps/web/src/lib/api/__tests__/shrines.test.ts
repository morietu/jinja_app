import { describe, it, expect, vi, beforeEach } from "vitest";
import { getShrines, fetchNearestShrines, getPopularShrines } from "../shrines";
import * as shrinesApi from "../shrines";
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

  it("getShrinePublic: shrines.client に委譲する", async () => {
    const spy = vi
      .spyOn(await import("../shrines.client"), "getShrinePublicClient")
      .mockResolvedValue({ id: 10, name_jp: "明治神宮" } as any);

    const res = await shrinesApi.getShrinePublic(10);

    expect(spy).toHaveBeenCalledWith(10);
    expect(res).toEqual({ id: 10, name_jp: "明治神宮" });
  });

  it("getShrines: shrines.list.client に委譲する", async () => {
    const spy = vi
      .spyOn(await import("../shrines.list.client"), "getShrinesClient")
      .mockResolvedValue([{ id: 2, name_jp: "神社B" }] as any);

    const res = await shrinesApi.getShrines({ q: "test" });

    expect(spy).toHaveBeenCalledWith({ q: "test" });
    expect(res).toEqual([{ id: 2, name_jp: "神社B" }]);
  });

  it("getShrinePrivate: 成功時は json を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 99, private: true }),
      }) as any,
    );

    const res = await shrinesApi.getShrinePrivate(99);

    expect(global.fetch).toHaveBeenCalledWith("/api/shrines/99/data/", {
      cache: "no-store",
      credentials: "include",
    });
    expect(res).toEqual({ id: 99, private: true });
  });

  it("getShrinePrivate: 失敗時は body を含めて throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "server exploded",
      }) as any,
    );

    await expect(shrinesApi.getShrinePrivate(77)).rejects.toThrow(/getShrinePrivate failed: 500 body=server exploded/);
  });

  it("fetchNearestShrines: paginated をそのまま返す", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        count: 3,
        next: "/next",
        previous: null,
        results: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    } as any);

    const res = await shrinesApi.fetchNearestShrines({ lat: 35, lng: 139 });

    expect(res.count).toBe(3);
    expect(res.next).toBe("/next");
    expect(res.results).toHaveLength(3);
  });

  it("createShrine: post 結果を返す", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: { id: 123, name_jp: "新規神社" },
    } as any);

    const payload = { name_jp: "新規神社" };

    const res = await shrinesApi.createShrine(payload);

    expect(api.post).toHaveBeenCalledWith("/my/shrines/", payload);
    expect(res).toEqual({ id: 123, name_jp: "新規神社" });
  });
});
