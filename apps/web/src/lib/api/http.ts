// apps/web/src/lib/api/http.ts
import axios, { AxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";


const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

function resolveUrl(path: string) {
  // 余計なスラッシュを除去: /api/foo/?a=1 → /api/foo?a=1
  if (path.includes("/?")) path = path.replace("/?", "?");

  // すでに絶対URLならそのまま返す
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const base = (API_BASE || "/api").replace(/\/+$/, ""); // 末尾の / を削る
  const rel = path.startsWith("/") ? path : `/${path}`;

  // ここでは new URL を使わず文字列結合にすることで、
  // base が "/api" のような相対パスでも安全に動く
  return `${base}${rel}`;
}


export async function apiGet<T>(url: string, config: AxiosRequestConfig = {}) {
  const r = await api.get<T>(resolveUrl(url), config);
  return r.data as T;
}

export async function apiPost<T>(
  url: string,
  data?: unknown,
  config: AxiosRequestConfig = {}
) {
  const r = await api.post<T>(resolveUrl(url), data, config);
  return r.data as T;
}

export async function apiPatch<T>(
  url: string,
  data?: unknown,
  config: AxiosRequestConfig = {}
) {
  const r = await api.patch<T>(resolveUrl(url), data, config);
  return r.data as T;
}

export async function apiDelete(url: string, config: AxiosRequestConfig = {}) {
  await api.delete(resolveUrl(url), config);
}

export async function apiPatchForm<T>(
  url: string,
  form: FormData,
  config: AxiosRequestConfig = {}
) {
  const r = await api.patch<T>(resolveUrl(url), form, {
    ...config,
    headers: {
      ...(config.headers ?? {}),
      "Content-Type": "multipart/form-data",
    },
  });
  return r.data as T;
}

export function isAuthError(e: unknown) {
  // 過剰any回避しつつ 401 判定
  return (
    typeof e === "object" && e !== null && (e as any)?.response?.status === 401
  );
}
