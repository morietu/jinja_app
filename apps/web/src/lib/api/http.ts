// apps/web/src/lib/api/http.ts
import api from "./client";
import type { AxiosRequestConfig } from "axios";

// 先頭スラッシュ強制 + 二重スラッシュ潰し
const norm = (u: string) => ("/" + u.replace(/^\/+/, "")).replace(/\/{2,}/g, "/");

export async function apiGet<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.get<T>(norm(url), config);
  return data;
}
export async function apiPost<T>(url: string, body?: any, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.post<T>(norm(url), body, config);
  return data;
}
export async function apiPatch<T>(url: string, body?: any, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.patch<T>(norm(url), body, config);
  return data;
}
export async function apiDelete<T = void>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.delete<T>(norm(url), config);
  return data as T;
}

// 401 を UI で握りたい時の判定補助
export function isAuthError(e: unknown) {
  return !!(e as any)?.response && (e as any).response.status === 401;
}
