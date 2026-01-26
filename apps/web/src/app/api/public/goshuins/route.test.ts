// apps/web/src/app/api/public/goshuins/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

describe("/api/public/goshuins route", () => {
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

  it("shrine が無いと 400", async () => {
    const req = new Request("http://localhost:3000/api/public/goshuins?limit=12&offset=0");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("shrine is required");
  });

  it("limit=999 は 48 にクランプして results が 48 件になる", async () => {
    const upstreamRows = Array.from({ length: 60 }).map((_, i) => ({
      id: i + 1,
      shrine: 1,
      is_public: true,
    }));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(upstreamRows), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const req = new Request("http://localhost:3000/api/public/goshuins?shrine=1&limit=999&offset=0");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(48);
  });

  

  it("offset による slice が効く", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: 1, shrine: 1, is_public: true },
          { id: 2, shrine: 1, is_public: true },
          { id: 3, shrine: 1, is_public: true },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const req = new Request("http://localhost:3000/api/public/goshuins?shrine=1&limit=1&offset=1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].id).toBe(2);
  });
});
