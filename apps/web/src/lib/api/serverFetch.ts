// apps/web/src/lib/api/serverFetch.ts
import "server-only";

const RAW =
  process.env.API_BASE_SERVER ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://127.0.0.1:8000";

// 末尾スラ&重複スラ整理して /api を付与
const BASE = RAW.replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";

export function apiFetch(path: string, init: RequestInit = {}) {
  const clean = String(path).replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  const url = `${BASE}/${clean}`.replace(/([^:])\/{2,}/g, "$1/");

  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
}
