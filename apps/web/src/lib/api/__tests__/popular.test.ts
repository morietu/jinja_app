import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPopular, fetchPopularPage } from "../popular";

describe("lib/api/popular fetchPopular", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("通常パス: data.items を拾う（queryなし）", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 3 }], next: null }),
    } as any);

    const res = await fetchPopular({});

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String((fetchSpy.mock.calls[0] as any)[0])).toContain("/api/populars/");
    expect((fetchSpy.mock.calls[0] as any)[1]).toEqual({ cache: "no-store" });

    expect(res.items).toEqual([{ id: 3 }]);
    expect(res.next).toBeNull();
  });

  it("通常パス: queryあり（limit/near/radius_km）", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 4 }], next: null }),
    } as any);

    const res = await fetchPopular({ limit: 10, near: "1,2", radius_km: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String((fetchSpy.mock.calls[0] as any)[0]);
    expect(calledUrl).toContain("/api/populars/?");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("near=1%2C2");
    expect(calledUrl).toContain("radius_km=5");

    expect(res.items).toEqual([{ id: 4 }]);
  });

  it("next は BFF 相対URL (/api/populars/...) を返す", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 5 }],
        next: "/api/populars/?limit=10&page=2",
      }),
    } as any);

    const res = await fetchPopular({ limit: 10 });

    expect(res.items).toEqual([{ id: 5 }]);
    expect(res.next).toBe("/api/populars/?limit=10&page=2");
  });

  it("通常パス: ok=false は throw", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as any);

    await expect(fetchPopular({})).rejects.toThrow("failed to fetch popular shrines");
  });
});

describe("fetchPopularPage guard", () => {
  it("/api/populars/ 以外は拒否する", async () => {
    await expect(fetchPopularPage("/api/evil/?x=1")).rejects.toThrow("invalid populars next url");
    await expect(fetchPopularPage("/populars/?x=1")).rejects.toThrow("invalid populars next url");
    await expect(fetchPopularPage("https://example.com/api/populars/?page=2")).rejects.toThrow(
      "invalid populars next url",
    );
  });

  it("正しいパスなら fetch する", async () => {
    const spy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 1 }], next: null }),
    } as any);

    const res = await fetchPopularPage("/api/populars/?limit=10&page=2");

    expect(spy).toHaveBeenCalledWith("/api/populars/?limit=10&page=2", { cache: "no-store" });
    expect(res.items).toEqual([{ id: 1 }]);
    expect(res.next).toBeNull();
  });
});
