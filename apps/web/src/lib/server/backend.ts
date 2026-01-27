import type { NextRequest } from "next/server";
import { serverLog } from "@/lib/server/logging";

const BACKEND_ORIGIN =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.BACKEND_ORIGIN ||
      "https://jinja-backend.onrender.com"
    : "http://127.0.0.1:8000";

const DJ_FETCH_DEBUG = process.env.NODE_ENV !== "production" && process.env.DJ_FETCH_DEBUG === "1";

export async function djFetch(
  reqOrPath: NextRequest | string,
  pathOrInit?: string | RequestInit,
  maybeInit?: RequestInit,
) {
  let req: NextRequest | null = null;
  let path: string;
  let init: RequestInit;

  if (typeof reqOrPath === "string") {
    path = reqOrPath;
    init = (pathOrInit as RequestInit) ?? {};
  } else {
    req = reqOrPath;
    if (typeof pathOrInit !== "string") {
      throw new Error("djFetch(req, path, init) の path は string 必須です");
    }
    path = pathOrInit;
    init = maybeInit ?? {};
  }

  const url = new URL(path, BACKEND_ORIGIN).toString();
  const headers = new Headers(init.headers ?? {});

  if (req) {
    const incomingAuth = req.headers.get("authorization");
    const cookie = req.headers.get("cookie") || "";
    const contentType = req.headers.get("content-type");

    if (incomingAuth && !headers.has("Authorization")) {
      headers.set("Authorization", incomingAuth);
    }

    // cookie -> Authorization（access_token 優先）
    if (!headers.has("Authorization")) {
      const access = req.cookies.get("access_token")?.value;
      const fallback = (() => {
        const m = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : null;
      })();
      const token = access || fallback;
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    if (cookie && !headers.has("cookie")) {
      headers.set("cookie", cookie);
    }

    const csrf = req.headers.get("x-csrftoken") ?? req.headers.get("x-csrf-token");
    if (csrf && !headers.has("x-csrftoken")) headers.set("x-csrftoken", csrf);

    const origin = req.headers.get("origin");
    if (origin && !headers.has("origin")) headers.set("origin", origin);

    const referer = req.headers.get("referer");
    if (referer && !headers.has("referer")) headers.set("referer", referer);

    // multipart のとき Content-Type は set しない（boundaryが壊れる）
    const isFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (contentType && !headers.has("Content-Type") && !isFormDataBody) {
      headers.set("Content-Type", contentType);
    }

    // ✅ 最終状態だけログ（値は出さない）
    if (DJ_FETCH_DEBUG) {
      serverLog("debug", "DJ_FETCH_FORWARD", {
        url,
        hasAuth: !!headers.get("Authorization"),
        hasCookie: !!headers.get("cookie"),
        contentType: headers.get("Content-Type") || null,
      });
    }
  }

  const finalInit: RequestInit & { duplex?: "half" } = {
    ...init,
    headers,
    credentials: "include",
  };

  const method = (init.method || (req ? req.method : "GET")).toUpperCase();
  if (init.body && method !== "GET" && method !== "HEAD") {
    (finalInit as any).duplex = "half";
  }

  // dev のみ Host 固定
  if (process.env.NODE_ENV !== "production") {
    headers.set("Host", "127.0.0.1");
  }

  return fetch(url, finalInit);
}
