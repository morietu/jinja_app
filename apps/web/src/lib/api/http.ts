import type { AxiosRequestConfig } from "axios";
import api from "./client";

const norm = (u: string) => (u.startsWith("/") ? u : `/${u}`); // ← 復活

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
export async function apiDelete(url: string, config: AxiosRequestConfig = {}): Promise<void> {
  await api.delete(norm(url), config);
}
export async function apiPatchForm<T>(url: string, form: FormData, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.patch<T>(norm(url), form, {
    headers: { "Content-Type": "multipart/form-data", ...(config.headers || {}) },
    ...config,
  });
  return data;
}

export function isAuthError(e: unknown) {
  return !!(e as any)?.response && (e as any).response.status === 401;
}
