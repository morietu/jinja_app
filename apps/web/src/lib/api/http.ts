// apps/web/src/lib/api/http.ts
import type { AxiosRequestConfig } from "axios";
import api from "@/lib/api/client";

// 先頭スラッシュを剥がす（baseURL が末尾 `/` 前提）
const strip = (u: string) => u.replace(/^\//, "");

export async function apiGet<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.get<T>(strip(url), config);
  return data;
}
export async function apiPost<T>(url: string, body?: any, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.post<T>(strip(url), body, config);
  return data;
}
export async function apiPatch<T>(url: string, body?: any, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.patch<T>(strip(url), body, config);
  return data;
}
export async function apiDelete(url: string, config: AxiosRequestConfig = {}): Promise<void> {
  await api.delete(strip(url), config);
}
export async function apiPatchForm<T>(url: string, form: FormData, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.patch<T>(strip(url), form, {
    headers: { "Content-Type": "multipart/form-data", ...(config.headers || {}) },
    ...config,
  });
  return data;
}

export function isAuthError(e: unknown) {
  return !!(e as any)?.response && (e as any).response.status === 401;
}
