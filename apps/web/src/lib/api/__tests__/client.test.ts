/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, it, expect } from "vitest";
import api from "../client";

function getRequestInterceptor() {
  const handlers = (api as any).interceptors.request.handlers;
  expect(handlers?.length).toBeGreaterThan(0);
  return handlers[0].fulfilled as (config: any) => any; // CSRF interceptor
}

function clearCookie(name: string) {
  // jsdom は path が一致しないと消えないことがあるので path=/ を付ける
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

beforeEach(() => {
  clearCookie("csrftoken");
});

describe("api client (csrf interceptor)", () => {
  it("GET のときは CSRF ヘッダを付けない", () => {
    document.cookie = "csrftoken=abc; path=/";
    const run = getRequestInterceptor();

    const cfg = run({ method: "get", headers: {} });

    expect((cfg.headers as any)["X-CSRFToken"]).toBeUndefined();
  });

  it("POST かつ csrftoken がある場合、headers が未定義でも X-CSRFToken を付与する", () => {
    document.cookie = "csrftoken=token123; path=/";
    const run = getRequestInterceptor();

    const cfg = run({ method: "post" }); // headers: undefined

    expect(cfg.headers).toBeDefined();
    expect((cfg.headers as any)["X-CSRFToken"]).toBe("token123");
  });

  it("POST でも csrftoken が無い場合は X-CSRFToken を付けない", () => {
    // beforeEach で消えてる想定
    const run = getRequestInterceptor();

    const cfg = run({ method: "post", headers: {} });

    expect((cfg.headers as any)["X-CSRFToken"]).toBeUndefined();
  });

  it("document が undefined の場合は CSRF を付けない（getCookie が null を返す）", () => {
    const original = (globalThis as any).document;
    (globalThis as any).document = undefined;

    try {
      const run = getRequestInterceptor();
      const cfg = run({ method: "post", headers: {} });
      expect((cfg.headers as any)["X-CSRFToken"]).toBeUndefined();
    } finally {
      (globalThis as any).document = original;
    }
  });
});
