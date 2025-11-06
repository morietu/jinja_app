// apps/web/src/lib/api/http.ts
import axios, { AxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

function resolveUrl(url: string) {
  // 余計なスラッシュを除去: /api/foo/?a=1 → /api/foo?a=1
  if (url.includes("/?")) url = url.replace("/?", "?");

  // すでに絶対URLならそのまま
  try {
    new URL(url);
    return url;
  } catch {
    // 相対URL → ベースを補完
  }

  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    (typeof window === "undefined"
      ? "http://localhost:3000"
      : window.location.origin);

  return new URL(url, base).toString();
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
