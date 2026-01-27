import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPopular } from "../popular";

describe("lib/api/popular fetchPopular", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("urlOverride あり: data が配列なら items はそれ", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 1 }],
    } as any);

    const res = await fetchPopular({ urlOverride: "https://example.com/next" });

    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/next", { cache: "no-store" });
    expect(res.items).toEqual([{ id: 1 }]);
    expect(res.next).toBeNull();
  });

  it("urlOverride あり: data.results を拾う & next を拾う", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 2 }], next: "https://example.com/n2" }),
    } as any);

    const res = await fetchPopular({ urlOverride: "https://example.com/next" });

    expect(res.items).toEqual([{ id: 2 }]);
    expect(res.next).toBe("https://example.com/n2");
  });

  it("urlOverride あり: ok=false は throw", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as any);

    await expect(fetchPopular({ urlOverride: "https://example.com/next" })).rejects.toThrow(
      "failed to fetch popular shrines",
    );
  });

  it("通常パス: data.items を拾う（queryなし）", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 3 }], next: null }),
    } as any);

    const res = await fetchPopular({}); // limit/near/radius なし

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // URLの完全一致は環境変数絡むので「含む」で確認
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
    expect(calledUrl).toContain("near=1%2C2"); // URLSearchParams で encode される
    expect(calledUrl).toContain("radius_km=5");

    expect(res.items).toEqual([{ id: 4 }]);
  });

  it("通常パス: ok=false は throw", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as any);

    await expect(fetchPopular({})).rejects.toThrow("failed to fetch popular shrines");
  });
});
