// apps/web/src/lib/api/__tests__/http.test.ts
import { describe, it, expect } from "vitest";
import { __resolveUrlForTest, isAuthError } from "@/lib/api/http";

describe("__resolveUrlForTest", () => {
  it("絶対URLはそのまま返す", () => {
    const url = "https://example.com/foo?bar=1";
    expect(__resolveUrlForTest(url)).toBe(url);
  });

  it("相対パスは /api ベースで結合される（デフォルト環境）", () => {
    // NEXT_PUBLIC_API_BASE が未定義なら "/api" ベースになる
    expect(__resolveUrlForTest("/my/goshuin/")).toBe("/api/my/goshuin/");
    expect(__resolveUrlForTest("my/goshuin/")).toBe("/api/my/goshuin/");
  });

  it("/? を ? に正規化する", () => {
    expect(__resolveUrlForTest("/my/goshuin/?a=1")).toBe("/api/my/goshuin?a=1");
  });
});

describe("isAuthError", () => {
  it("status=401 のエラーオブジェクトなら true を返す", () => {
    const err = { response: { status: 401 } };
    expect(isAuthError(err)).toBe(true);
  });

  it("401 以外や不正な値なら false を返す", () => {
    expect(isAuthError({ response: { status: 403 } })).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError("oops")).toBe(false);
    expect(isAuthError({})).toBe(false);
  });
});
