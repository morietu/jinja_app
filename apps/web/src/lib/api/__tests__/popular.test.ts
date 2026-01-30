import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPopular } from "../popular";

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

  it("next が BFF 形式ならそのまま返す（= BFF が rewrite 済み前提）", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 5 }],
        next: "http://localhost:3000/api/populars/?limit=10&offset=10",
      }),
    } as any);

    const res = await fetchPopular({ limit: 10 });

    expect(res.items).toEqual([{ id: 5 }]);
    expect(res.next).toContain("/api/populars/?");
    expect(res.next).toContain("offset=10");
  });

  it("通常パス: ok=false は throw", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as any);

    await expect(fetchPopular({})).rejects.toThrow("failed to fetch popular shrines");
  });
});
