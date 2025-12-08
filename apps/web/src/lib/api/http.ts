// apps/web/src/lib/api/http.ts
import type { AxiosRequestConfig } from "axios";
import api from "./client";

/**
 * フロントから見る URL を組み立てる。
 * baseURL は client.ts 側で "/api" に固定しているので、
 * ここでは `/my/profile/` のような相対パスだけ返せばよい。
 */
function resolveUrl(path: string) {
  // /api/foo/?a=1 → /api/foo?a=1
  if (path.includes("/?")) {
    path = path.replace("/?", "?");
  }

  // すでに絶対URLならそのまま返す
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  // 先頭に / を付けるだけ
  return path.startsWith("/") ? path : `/${path}`;
}

export async function apiGet<T>(url: string, config: AxiosRequestConfig = {}) {
  const r = await api.get<T>(resolveUrl(url), config);
  return r.data as T;
}

export async function apiPost<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}) {
  const r = await api.post<T>(resolveUrl(url), data, config);
  return r.data as T;
}

export async function apiPatch<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}) {
  const r = await api.patch<T>(resolveUrl(url), data, config);
  return r.data as T;
}

export async function apiDelete(url: string, config: AxiosRequestConfig = {}) {
  await api.delete(resolveUrl(url), config);
}

export async function apiPatchForm<T>(url: string, form: FormData, config: AxiosRequestConfig = {}) {
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
  return typeof e === "object" && e !== null && (e as any)?.response?.status === 401;
}

export function __resolveUrlForTest(input: string): string {
  return resolveUrl(input);
}
