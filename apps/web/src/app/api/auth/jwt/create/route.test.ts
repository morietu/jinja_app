import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";

import { POST } from "./route";

const DJANGO_ORIGIN = "http://127.0.0.1:8000";
const UPSTREAM = `${DJANGO_ORIGIN}/api/auth/jwt/create/`;

const server = setupServer();

beforeAll(() => {
  process.env.DJANGO_BASE_URL = DJANGO_ORIGIN;
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs(); // ✅ NODE_ENV などの汚染を戻す
});

afterAll(() => server.close());

function makeReq(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/jwt/create", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

function getSetCookies(res: Response): string[] {
  const h: any = res.headers;
  if (typeof h.getSetCookie === "function") return h.getSetCookie();
  const raw = typeof h.raw === "function" ? h.raw() : null;
  if (raw?.["set-cookie"]) return raw["set-cookie"];
  const sc = res.headers.get("set-cookie");
  return sc ? [sc] : [];
}

describe("/api/auth/jwt/create contract", () => {
  it("success: upstream 200 -> ok:true + 2 cookies", async () => {
    server.use(
      http.post(UPSTREAM, async () => {
        return HttpResponse.json({ access: "ACCESS_TOKEN", refresh: "REFRESH_TOKEN" }, { status: 200 });
      }),
    );

    const req = makeReq({ username: "u", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const cookies = getSetCookies(res).join("\n");
    expect(cookies).toContain("access_token=");
    expect(cookies).toContain("refresh_token=");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("Path=/");
    expect(cookies).toContain("SameSite=Lax");
  });

  it("upstream error -> route returns json + same status", async () => {
    server.use(
      http.post(UPSTREAM, async () => {
        return HttpResponse.json({ detail: "bad" }, { status: 401 });
      }),
    );

    const req = makeReq({ username: "u", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty("detail");
  });

  it("upstream network error -> 5xx", async () => {
    server.use(
      http.post(UPSTREAM, async () => {
        return HttpResponse.error();
      }),
    );

    const req = makeReq({ username: "u", password: "p" });
    const res = await POST(req);

    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it("secure cookie: production + x-forwarded-proto=https -> Secure flag set", async () => {
    vi.stubEnv("NODE_ENV", "production"); // ✅ 直代入しない

    server.use(
      http.post(UPSTREAM, async () => {
        return HttpResponse.json({ access: "ACCESS_TOKEN", refresh: "REFRESH_TOKEN" }, { status: 200 });
      }),
    );

    const req = makeReq({ username: "u", password: "p" }, { "x-forwarded-proto": "https" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const cookies = getSetCookies(res).join("\n");
    expect(cookies).toMatch(/;\s*Secure/i);
  });
});
