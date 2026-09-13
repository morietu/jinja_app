// apps/web/src/app/api/auth/login/route.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";

import { POST } from "./route";

vi.mock("server-only", () => ({}));

const DJANGO_ORIGIN = "http://127.0.0.1:8000";
const UPSTREAM_LOGIN = `${DJANGO_ORIGIN}/api/auth/jwt/create/`;

const server = setupServer();

beforeAll(() => {
  process.env.DJANGO_BASE_URL = DJANGO_ORIGIN;
  process.env.AUTH_DEBUG = "0";
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs(); // ✅ env汚染を残さない
});

afterAll(() => server.close());

function makeReq(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/login", {
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

describe("/api/auth/login contract", () => {
  it.each(["42", null])("upstream 429 preserves Retry-After %s without body or cookies", async (retryAfter) => {
    server.use(
      http.post(UPSTREAM_LOGIN, () => HttpResponse.json(
        { detail: "internal username information", access: "SECRET", remaining: 0 },
        { status: 429, headers: retryAfter ? { "Retry-After": retryAfter } : {} },
      )),
    );
    const res = await POST(makeReq({ username: "u", password: "p" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe(retryAfter);
    expect(await res.json()).toEqual({
      detail: "ログイン試行回数が多すぎます。しばらく待ってから再試行してください。",
    });
    expect(getSetCookies(res)).toEqual([]);
  });

  it("success: upstream 200 -> ok:true + 2 cookies", async () => {
    server.use(
      http.post(UPSTREAM_LOGIN, async () => {
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
    expect(cookies).toMatch(/;\s*SameSite=lax/i);
    expect(cookies).not.toMatch(/;\s*Secure/i); // dev想定
  });

  it("upstream 401 -> route returns json + same status", async () => {
    server.use(
      http.post(UPSTREAM_LOGIN, async () => {
        return HttpResponse.json({ detail: "Nope" }, { status: 401 });
      }),
    );

    const req = makeReq({ username: "u", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty("detail");
    expect(json).toHaveProperty("upstreamStatus", 401);
  });

  it("upstream network error -> 503", async () => {
    server.use(
      http.post(UPSTREAM_LOGIN, async () => {
        return HttpResponse.error();
      }),
    );

    const req = makeReq({ username: "u", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(503);
    expect(await res.json()).toHaveProperty("detail");
  });

  it("secure cookie: production + x-forwarded-proto=https -> Secure flag set", async () => {
    vi.stubEnv("NODE_ENV", "production"); // ✅ 直代入しない

    server.use(
      http.post(UPSTREAM_LOGIN, async () => {
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
