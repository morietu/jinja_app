// apps/web/src/lib/api/http.ts
import type { AxiosRequestConfig } from "axios";
import api from "./client";

export async function apiGet<T>(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<T> {
  const r = await api.get(url, config);
  return r.data as T;
}
export async function apiPost<T>(
  url: string,
  body?: any,
  config: AxiosRequestConfig = {}
): Promise<T> {
  const r = await api.post(url, body, config);
  return r.data as T;
}
export async function apiPatch<T>(
  url: string,
  body?: any,
  config: AxiosRequestConfig = {}
): Promise<T> {
  const r = await api.patch(url, body, config);
  return r.data as T;
}
export async function apiDelete(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<void> {
  await api.delete(url, config);
}
export async function apiPatchForm<T>(
  url: string,
  form: FormData,
  config: AxiosRequestConfig = {}
): Promise<T> {
  const r = await api.patch(url, form, {
    ...config,
    headers: {
      ...(config.headers as any),
      "Content-Type": "multipart/form-data",
    },
  });
  return r.data as T;
}
export function isAuthError(e: unknown) {
  return (e as any)?.response?.status === 401;
}
