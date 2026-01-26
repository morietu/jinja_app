import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

describe("/api/public/goshuins/feed route", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
    process.env.DJANGO_API_BASE_URL = "http://127.0.0.1:8000";
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it("limit=999 は 50 にクランプして upstream を叩く", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const req = new Request("http://localhost:3000/api/public/goshuins/feed?limit=999");
    const res = await GET(req);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("/api/goshuins/feed/?limit=50");
    expect(res.status).toBe(200);
  });

  it("upstream が text/html を返したら 502 で落とす", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>nope</html>", {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    const req = new Request("http://localhost:3000/api/public/goshuins/feed?limit=12");
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("upstream returned non-json");
  });

  it("upstream not ok は 502 + JSON で返す（HTMLをそのまま返さない）", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("internal error", {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const req = new Request("http://localhost:3000/api/public/goshuins/feed?limit=12");
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("upstream not ok");
  });
});
