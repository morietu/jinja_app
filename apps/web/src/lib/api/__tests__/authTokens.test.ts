/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getCookie, setCookie, readJwtExp, isExpiringSoon } from "@/lib/api/authTokens";

// payload を base64url にする（= padding は残す。readJwtExp は atob 前に urlsafe→base64 変換するだけで padding 付与はしないため）
function base64urlWithPadding(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = Buffer.from(json, "utf8").toString("base64"); // padding あり
  return b64.replace(/\+/g, "-").replace(/\//g, "_");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64urlWithPadding({ alg: "none", typ: "JWT" });
  const body = base64urlWithPadding(payload);
  return `${header}.${body}.`;
}

describe("authTokens", () => {
  beforeEach(() => {
    document.cookie = "access_token=; Max-Age=0; path=/";
    document.cookie = "refresh_token=; Max-Age=0; path=/";
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  });

  it("setCookie/getCookie: 設定した値が取れる", () => {
    expect(getCookie("access_token")).toBeNull();

    setCookie("access_token", "abc");
    expect(getCookie("access_token")).toBe("abc");
  });

  it("readJwtExp: exp が読める", () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = makeJwt({ exp: now + 3600 });

    expect(readJwtExp(jwt)).toBe(now + 3600);
  });

  it("readJwtExp: payload が無い/壊れてる → null", () => {
    expect(readJwtExp("not-a-jwt")).toBeNull();
    expect(readJwtExp("a..c")).toBeNull(); // payload 空
  });

  it("readJwtExp: exp が無い → null", () => {
    const jwt = makeJwt({ sub: "u" });
    expect(readJwtExp(jwt)).toBeNull();
  });

  it("isExpiringSoon: exp が近い → true / 遠い → false", () => {
    const now = Math.floor(Date.now() / 1000);

    expect(isExpiringSoon(makeJwt({ exp: now + 10 }), 60)).toBe(true);
    expect(isExpiringSoon(makeJwt({ exp: now + 3600 }), 60)).toBe(false);
  });

  it("isExpiringSoon: exp が読めない → false（事前 refresh しない）", () => {
    expect(isExpiringSoon("broken", 60)).toBe(false);
  });
});
