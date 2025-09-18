// src/lib/apiFetch.ts
const RAW =
  process.env.API_BASE_SERVER ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://127.0.0.1:8000";

// 常に /api で終わる絶対URLに揃える
const ABSOLUTE_API_BASE = RAW.replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";

// "/path?x=1" を「先頭スラ無し・末尾スラ有り」に正規化してから結合
function normalize(path: string) {
  const [p0, qs] = path.split("?");
  let p = p0.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!p.endsWith("/")) p += "/";
  return qs ? `${p}?${qs}` : p;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = `${ABSOLUTE_API_BASE}/${normalize(path)}`.replace(/([^:])\/{2,}/g, "$1/");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };

  // （必要なら）SSRで Cookie のアクセストークンを Authorization に載せる
  if (typeof window === "undefined" && !("Authorization" in headers)) {
    try {
      const { cookies } = await import("next/headers");
      const token =
