// apps/web/src/app/api/auth/login/route.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";

import { POST } from "./route";

// upstream は dev 既定だとここに飛ぶ（getDjangoOrigin の dev fallback）
const DJANGO_ORIGIN = "http://127.0.0.1:8000";
const UPSTREAM_LOGIN = `${DJANGO_ORIGIN}/api/auth/jwt/create/`;

const server = setupServer();

beforeAll(() => {
  // テストが安定するように固定（route 内の getDjangoOrigin が読む）
  process.env.DJANGO_BASE_URL = DJANGO_ORIGIN;
  process.env.AUTH_DEBUG = "0";
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => server.resetHandlers());
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

// NextResponse/Headers の環境差を吸収して Set-Cookie を配列で取る
function getSetCookies(res: Response): string[] {
  const h: any = res.headers;

  // undici/next が対応してる環境
  if (typeof h.getSetCookie === "function") return h.getSetCookie();

  // 一部環境の raw()
  const raw = typeof h.raw === "function" ? h.raw() : null;
  if (raw?.["set-cookie"]) return raw["set-cookie"];

  // 最後の手段（複数 Set-Cookie が潰れる可能性あり）
  const sc = res.headers.get("set-cookie");
  return sc ? [sc] : [];
}

describe("/api/auth/login contract", () => {
  it("success: upstream 200 -> ok:true + 2 cookies", async () => {
    server.use(
      http.post(UPSTREAM_LOGIN, async () => {
        return HttpResponse.json({ access: "ACCESS_TOKEN", refresh: "REFRESH_TOKEN" }, { status: 200 });
      }),
    );

    const req = makeReq({ username: "u", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });

    const cookies = getSetCookies(res);
    // 2本あるのが理想。環境で潰れるときは名前が両方含まれるかでも守る
    expect(cookies.join("\n")).toContain("access_token=");
    expect(cookies.join("\n")).toContain("refresh_token=");
    expect(cookies.join("\n")).toContain("HttpOnly");
    expect(cookies.join("\n")).toContain("Path=/");
    expect(cookies.join("\n")).toContain("SameSite=Lax");

    // dev では secure は付かない（isSecureCookie(req) が false）
    expect(cookies.join("\n")).not.toMatch(/;\s*Secure/i);
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
        // fetch が throw する形
        return HttpResponse.error();
      }),
    );

    const req = makeReq({ username: "u", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toHaveProperty("detail");
  });

  it("secure cookie: x-forwarded-proto=https -> Secure flag set", async () => {
    // 本番相当の分岐に入れるため production にする
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

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

    process.env.NODE_ENV = prevNodeEnv;
  });
});
