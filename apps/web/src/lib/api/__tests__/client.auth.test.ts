/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../client";

function setCookieRaw(s: string) {
  document.cookie = s;
}
function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

function truthyHandlers(handlers: any[] | undefined) {
  return (handlers ?? []).filter(Boolean);
}

function getCsrfRequestInterceptor() {
  const handlers = truthyHandlers((api as any).interceptors.request.handlers);
  // CSRF interceptor だけ、の想定
  expect(handlers.length).toBeGreaterThanOrEqual(1);
  return handlers[0].fulfilled as (config: any) => any;
}

describe("api client (auth interceptors) - new spec", () => {
  beforeEach(() => {
    clearCookie("access_token");
    clearCookie("refresh_token");
    clearCookie("csrftoken");
    vi.restoreAllMocks();
  });

  it("POST 等のとき X-CSRFToken が付与される", async () => {
    setCookieRaw(`csrftoken=csrf-xxx; path=/`);

    const run = getCsrfRequestInterceptor();
    const cfg = await run({ method: "post", headers: {} });

    expect((cfg.headers as any)["X-CSRFToken"]).toBe("csrf-xxx");
  });

  it("GET のとき X-CSRFToken は付与されない", async () => {
    setCookieRaw(`csrftoken=csrf-xxx; path=/`);

    const run = getCsrfRequestInterceptor();
    const cfg = await run({ method: "get", headers: {} });

    expect((cfg.headers as any)["X-CSRFToken"]).toBeUndefined();
  });

  it("Authorization / refresh / retry 系 interceptor は存在しない（BFFに委譲）", () => {
    const reqHandlers = truthyHandlers((api as any).interceptors.request.handlers);
    const resHandlers = truthyHandlers((api as any).interceptors.response.handlers);

    // request は CSRF 1本想定（増えたらここを緩める）
    expect(reqHandlers.length).toBe(1);
    // response 側の retry はしない
    expect(resHandlers.length).toBe(0);
  });
});
