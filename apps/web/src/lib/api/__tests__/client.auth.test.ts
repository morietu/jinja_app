/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import api from "../client";

// cookie utility
function setCookieRaw(s: string) {
  document.cookie = s;
}
function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

// JWT exp を「もうすぐ切れる」状態にする（isExpiringSoon が true になる）
function base64urlWithPadding(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = Buffer.from(json, "utf8").toString("base64"); // paddingあり
  return b64.replace(/\+/g, "-").replace(/\//g, "_"); // paddingは残す
}
function makeJwt(expSecFromNow: number) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlWithPadding({ alg: "none", typ: "JWT" });
  const body = base64urlWithPadding({ exp: now + expSecFromNow });
  return `${header}.${body}.`;
}

function getAuthRequestInterceptor() {
  const handlers = (api as any).interceptors.request.handlers;
  // [0]=CSRF, [1]=auth(事前refresh+Authorization)
  expect(handlers?.length).toBeGreaterThanOrEqual(2);
  return handlers[1].fulfilled as (config: any) => Promise<any>;
}

function getResponseRejectedInterceptor() {
  const handlers = (api as any).interceptors.response.handlers;
  expect(handlers?.length).toBeGreaterThanOrEqual(1);
  return handlers[0].rejected as (err: any) => Promise<any>;
}

describe("api client (auth interceptors)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearCookie("access_token");
    clearCookie("refresh_token");
    clearCookie("csrftoken");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("access_token が expiringSoon のとき refresh を叩いて Authorization に新 token を載せる", async () => {
    // exp が近い access
    setCookieRaw(`access_token=${encodeURIComponent(makeJwt(10))}; path=/`);
    setCookieRaw(`refresh_token=${encodeURIComponent("refresh-xxx")}; path=/`);

    // refresh の戻り
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ access: "NEW_ACCESS" }), { status: 200 });
    }) as any;

    const run = getAuthRequestInterceptor();

    const cfg = await run({ method: "get", headers: {} });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect((cfg.headers as any).Authorization).toBe("Bearer NEW_ACCESS");
  });

  it("401 のとき refresh→1回だけ retry する（__retried が付く）", async () => {
    // refresh 用 cookie
    setCookieRaw(`refresh_token=${encodeURIComponent("refresh-xxx")}; path=/`);

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ access: "NEW_ACCESS" }), { status: 200 });
    }) as any;

    const apiRequestSpy = vi.spyOn(api, "request").mockResolvedValue({ ok: true } as any);

    const reject = getResponseRejectedInterceptor();

    const error = {
      response: { status: 401 },
      config: { url: "/my/profile/", method: "get", headers: {} },
    };

    const res = await reject(error);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect((error.config as any).__retried).toBe(true);
    expect((error.config.headers as any).Authorization).toBe("Bearer NEW_ACCESS");
    expect(res).toEqual({ ok: true });
  });

  it("__retried 済みの 401 は retry しない（そのまま throw）", async () => {
    const reject = getResponseRejectedInterceptor();

    const error = {
      response: { status: 401 },
      config: { __retried: true, url: "/x", method: "get", headers: {} },
    };

    await expect(reject(error)).rejects.toBe(error);
  });
});
