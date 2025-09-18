// apps/web/src/lib/http.ts
const ORIGIN =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"; // ← :8000 (Django)
const ABS = ORIGIN.replace(/\/+$/, "") + "/api"; // 例: http://127.0.0.1:8000/api
const BASE = typeof window === "undefined" ? ABS : "/api"; // SSR=絶対, CSR=相対

const join = (base: string, path: string) =>
  `${base.replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;

const withTrailingSlash = (u: string) => {
  const [p, qs] = u.split("?");
  return qs ? u : p.endsWith("/") ? u : p + "/";
};

/** API を path で呼ぶ。二重スラ禁止 & 末尾スラ付与。 */
export async function apiFetch(path: string, init?: RequestInit) {
  const url = withTrailingSlash(join(BASE, path));
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}
