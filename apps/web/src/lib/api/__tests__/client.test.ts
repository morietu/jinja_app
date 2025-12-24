/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import api from "../client";

function getRequestInterceptor() {
  // axios instance の request interceptor を直接叩く
  const handlers = (api as any).interceptors.request.handlers;
  expect(handlers?.length).toBeGreaterThan(0);
  return handlers[0].fulfilled as (config: any) => any;
}

describe("api client (csrf interceptor)", () => {
  it("GET のときは CSRF ヘッダを付けない", () => {
    document.cookie = "csrftoken=abc";
    const run = getRequestInterceptor();

    const cfg = run({ method: "get", headers: {} });

    expect((cfg.headers as any)["X-CSRFToken"]).toBeUndefined();
  });

  it("POST かつ csrftoken がある場合、headers が未定義でも X-CSRFToken を付与する", () => {
    document.cookie = "csrftoken=token123";
    const run = getRequestInterceptor();

    const cfg = run({ method: "post" }); // headers: undefined

    expect(cfg.headers).toBeDefined();
    expect((cfg.headers as any)["X-CSRFToken"]).toBe("token123");
  });

  it("POST でも csrftoken が無い場合は X-CSRFToken を付けない", () => {
    // cookie を空にする（jsdomは set で上書きできる）
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const run = getRequestInterceptor();

    const cfg = run({ method: "post", headers: {} });

    expect((cfg.headers as any)["X-CSRFToken"]).toBeUndefined();
  });

  it("document が undefined の場合は CSRF を付けない（getCookie が null を返す）", () => {
    const original = (globalThis as any).document;
    // jsdom環境でも一時的に document を潰して分岐を踏む
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
