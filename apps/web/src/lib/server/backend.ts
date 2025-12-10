// apps/web/src/lib/server/backend.ts
import type { NextRequest } from "next/server";

// 開発中は必ずローカル Django を見る
// 本番(Vercel)だけ環境変数 or Render を使う
const BACKEND_ORIGIN =
  process.env.NODE_ENV === "production"
    ? (
        process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.BACKEND_ORIGIN ||
        "https://jinja-backend.onrender.com"
      )
    : "http://127.0.0.1:8000";

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

    console.log("[djFetch] url:", url);
    console.log("[djFetch] incoming cookie:", cookie || "<none>");
    console.log("[djFetch] incoming auth:", incomingAuth || "<none>");
    console.log("[djFetch] incoming content-type:", contentType || "<none>");

    if (incomingAuth && !headers.has("Authorization")) {
      headers.set("Authorization", incomingAuth);
    }

    if (cookie && !headers.has("Authorization")) {
      const m = cookie.match(/access_token=([^;]+)/);
      if (m) {
        const token = decodeURIComponent(m[1]);
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    if (cookie && !headers.has("cookie")) {
      headers.set("cookie", cookie);
    }

    const isFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData;

    if (contentType && !headers.has("Content-Type") && !isFormDataBody) {
      headers.set("Content-Type", contentType);
    }

    console.log("[djFetch] forwarded Authorization:", headers.get("Authorization") || "<none>");
    console.log("[djFetch] forwarded Content-Type:", headers.get("Content-Type") || "<none>");
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

  return fetch(url, finalInit);
}
