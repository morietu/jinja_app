// apps/web/src/lib/server/backend.ts
import type { NextRequest } from "next/server";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";

// req を受けて Django API に転送するヘルパ
export async function djFetch(
  reqOrPath: NextRequest | string,
  pathOrInit?: string | RequestInit,
  maybeInit?: RequestInit,
) {
  let req: NextRequest | null = null;
  let path: string;
  let init: RequestInit;

  if (typeof reqOrPath === "string") {
    // 旧: djFetch("/api/...", init)
    path = reqOrPath;
    init = (pathOrInit as RequestInit) ?? {};
  } else {
    // 新: djFetch(req, "/api/...", init)
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
    // ① ブラウザから来た Authorization があればそのまま引き継ぐ
    const incomingAuth = req.headers.get("authorization");
    if (incomingAuth && !headers.has("Authorization")) {
      headers.set("Authorization", incomingAuth);
    }

    // ② Cookie から access_token を取り出して Bearer を付ける（なければスキップ）
    const cookie = req.headers.get("cookie") || "";
    if (cookie && !headers.has("Authorization")) {
      const m = cookie.match(/access_token=([^;]+)/);
      if (m) {
        const token = decodeURIComponent(m[1]);
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    // Django 側で Cookie も必要なら一応流しておく
    if (cookie && !headers.has("cookie")) {
      headers.set("cookie", cookie);
    }
  }

  // ★ ここから下が変更ポイント
  const finalInit: RequestInit & { duplex?: "half" } = {
    ...init,
    headers,
    credentials: "include",
  };

  // body 付きの非 GET/HEAD リクエストなら duplex を付与（Node18 必須）
  const method = (init.method || (req ? req.method : "GET")).toUpperCase();
  if (init.body && method !== "GET" && method !== "HEAD") {
    (finalInit as any).duplex = "half";
  }

  return fetch(url, finalInit);
}
