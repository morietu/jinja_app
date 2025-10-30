// apps/web/src/lib/api/client.ts
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { tokens } from "@/lib/auth/token";

const baseURL = (process.env.NEXT_PUBLIC_API_BASE ?? "/api/").replace(/\/+$/, "") + "/";

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
  headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
});

// リクエスト前に Bearer 付与
api.interceptors.request.use((cfg) => {
  const t = tokens.access;
  console.debug("[api] ->", cfg.method?.toUpperCase(), cfg.baseURL, cfg.url, { hasAuth: !!t });
  if (t) {
    cfg.headers = cfg.headers ?? {};
    (cfg.headers as any).Authorization = `Bearer ${t}`;
  }
  return cfg;
});

// 401 → refresh → 再送
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!error.response || error.response.status !== 401 || !original || original._retry) throw error;

    const refresh = tokens.refresh;
    if (!refresh) throw error;

    try {
      const r = await api.post<{ access: string }>("auth/jwt/refresh/", { refresh });
      tokens.set(r.data.access, refresh);
      original._retry = true;
      return api.request(original);
    } catch {
      tokens.clear();
      throw error;
    }
  }
);

export default api;
