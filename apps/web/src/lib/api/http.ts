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

  // base が "/api" のような相対パスでも安全に動く
  return `${base}${rel}`;
}

// ★ テスト用：内部 resolveUrl を叩くラッパー
export function __resolveUrlForTest(path: string) {
  return resolveUrl(path);
}

export async function apiGet<T>(path: string, config: AxiosRequestConfig = {}) {
  const r = await api.get<T>(resolveUrl(path), config);
  return r.data as T;
}

export async function apiPost<T>(path: string, data?: unknown, config: AxiosRequestConfig = {}) {
  const r = await api.post<T>(resolveUrl(path), data, config);
  return r.data as T;
}

export async function apiPatch<T>(path: string, data?: unknown, config: AxiosRequestConfig = {}) {
  const r = await api.patch<T>(resolveUrl(path), data, config);
  return r.data as T;
}

export async function apiDelete(path: string, config: AxiosRequestConfig = {}) {
  await api.delete(resolveUrl(path), config);
}

export async function apiPatchForm<T>(path: string, form: FormData, config: AxiosRequestConfig = {}) {
  const r = await api.patch<T>(resolveUrl(path), form, {
    ...config,
    headers: {
      ...(config.headers ?? {}),
      "Content-Type": "multipart/form-data",
    },
  });
  return r.data as T;
}

export function isAuthError(e: unknown) {
  // 過剰 any を避けつつ 401 判定
  return typeof e === "object" && e !== null && (e as any)?.response?.status === 401;
}
