import type { NextRequest } from "next/server";
import { serverLog } from "@/lib/server/logging";
import "server-only";

export function getDjangoOrigin() {
  const origin = process.env.DJANGO_ORIGIN || process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
  return origin.replace(/\/$/, "");
}

const DJ_FETCH_DEBUG = process.env.NODE_ENV !== "production" && process.env.DJ_FETCH_DEBUG === "1";

type DjFetchInit = RequestInit & {
  forwardAuth?: boolean;
};

export async function djFetch(
  reqOrPath: NextRequest | string,
  pathOrInit?: string | DjFetchInit,
  maybeInit?: DjFetchInit,
) {
  let req: NextRequest | null = null;
  let path: string;
  let init: DjFetchInit;

  if (typeof reqOrPath === "string") {
    path = reqOrPath;
    init = (pathOrInit as DjFetchInit) ?? {};
  } else {
    req = reqOrPath;
    if (typeof pathOrInit !== "string") {
      throw new Error("djFetch(req, path, init) の path は string 必須です");
    }
    path = pathOrInit;
    init = maybeInit ?? {};
  }

  const origin = getDjangoOrigin();
  const url = new URL(path, origin).toString();

  console.log("[DJ_FETCH]", {
    origin,
    path,
    url,
    method: init.method || (req ? req.method : "GET"),
    forwardAuth: init.forwardAuth ?? true,
  });

  const headers = new Headers(init.headers ?? {});
  const forwardAuth = init.forwardAuth ?? true;

  if (req) {
    const incomingAuth = req.headers.get("authorization");
    const cookie = req.headers.get("cookie") || "";
    const contentType = req.headers.get("content-type");

    if (forwardAuth) {
      if (incomingAuth && !headers.has("Authorization")) {
        headers.set("Authorization", incomingAuth);
      }

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

      const reqOrigin = req.headers.get("origin");
      if (reqOrigin && !headers.has("origin")) headers.set("origin", reqOrigin);

      const referer = req.headers.get("referer");
      if (referer && !headers.has("referer")) headers.set("referer", referer);
    }

    const isFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (contentType && !headers.has("Content-Type") && !isFormDataBody) {
      headers.set("Content-Type", contentType);
    }

    if (DJ_FETCH_DEBUG) {
      serverLog("debug", "DJ_FETCH_FORWARD", {
        url,
        forwardAuth,
        hasAuth: !!headers.get("Authorization"),
        hasCookie: !!headers.get("cookie"),
        contentType: headers.get("Content-Type") || null,
      });
    }
  }

  const { forwardAuth: _forwardAuth, ...restInit } = init;

  const finalInit: RequestInit & { duplex?: "half" } = {
    ...restInit,
    headers,
    credentials: "include",
  };

  const method = (finalInit.method || (req ? req.method : "GET")).toUpperCase();
  if (finalInit.body && method !== "GET" && method !== "HEAD") {
    (finalInit as any).duplex = "half";
  }

  function readResponseSetCookies(res: Response): string[] {
    const headersAny = res.headers as Headers & {
      getSetCookie?: () => string[];
      raw?: () => Record<string, string[]>;
    };

    if (typeof headersAny.getSetCookie === "function") {
      return headersAny.getSetCookie().filter(Boolean);
    }

    const raw = typeof headersAny.raw === "function" ? headersAny.raw()?.["set-cookie"] ?? [] : [];
    if (raw.length > 0) {
      return raw.filter(Boolean);
    }

    const single = res.headers.get("set-cookie");
    return single ? [single] : [];
  }

  const response = await fetch(url, finalInit);

  const responseHeadersAny = response.headers as Headers & {
    raw?: () => Record<string, string[]>;
  };
  const responseSetCookies = readResponseSetCookies(response);

  console.log("[DJ_FETCH_RESPONSE]", {
    url,
    method,
    status: response.status,
    contentType: response.headers.get("content-type"),
    setCookieCount: responseSetCookies.length,
    setCookies: responseSetCookies,
    hasLocation: Boolean(response.headers.get("location")),
  });

  console.log("[DJ_FETCH_RESPONSE_HEADERS]", {
    keys: Array.from(response.headers.keys()),
    setCookie: response.headers.get("set-cookie"),
    rawSetCookie: typeof responseHeadersAny.raw === "function" ? responseHeadersAny.raw()?.["set-cookie"] ?? null : null,
  });

  return response;
}
