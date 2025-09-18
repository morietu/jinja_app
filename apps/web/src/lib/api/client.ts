// apps/web/src/lib/api/client.ts
import axios, { InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false, // Cookie 認証にするなら true + CORS 設定
});

// 毎リクエストに Authorization を付与（ブラウザ実行時のみ）
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 のときだけ自動リフレッシュして再試行
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        if (!refresh) throw new Error("no refresh token");
        const { data } = await axios.post(`${API_BASE}/token/refresh/`, { refresh });
        localStorage.setItem("access_token", data.access);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        // ここでログアウト処理や /login へ遷移など
      }
    }
    return Promise.reject(error);
  }
);

const isServer = typeof window === "undefined";

// SSR=絶対URL, CSR=相対 /api （どちらも baseURL は末尾スラ無し）
const RAW = process.env.API_BASE_SERVER || process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
const ABSOLUTE_API_BASE = RAW.replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";
const BASE_URL = isServer ? ABSOLUTE_API_BASE : "/api";

const api = axios.create({
  baseURL: BASE_URL,          // ← ここが "/api"（CSR）か "http://.../api"（SSR）
  timeout: 10000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- リクエスト共通（先頭/除去 → //圧縮 → 末尾/付与 → Authorization 補完）----
api.interceptors.request.use((config) => {
  // baseURL の末尾スラは常に除去（保険）
  if (config.baseURL) config.baseURL = String(config.baseURL).replace(/\/+$/, "");

  // URL 整形（必ず「先頭スラ無し・末尾スラ有り」に）
  if (config.url) {
    const [rawPath, qs = ""] = String(config.url).split("?");
    let path = rawPath.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
    if (!path.endsWith("/")) path += "/";
    config.url = qs ? `${path}?${qs}` : path;
  }

  // Authorization 補完（CSRのみ）
  if (!isServer) {
    const hasAuth =
      !!(config.headers as any)?.Authorization ||
      !!api.defaults.headers.common["Authorization"];
    if (!hasAuth) {
      const tok = localStorage.getItem("access") || localStorage.getItem("access_token");
      if (tok) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${tok}`;
      }
    }
  }

  // デバッグ
  if (process.env.NODE_ENV !== "production") {
    const base = (config.baseURL ?? api.defaults.baseURL) as string;
    const full = `${base}/${config.url ?? ""}`.replace(/([^:])\/{2,}/g, "$1/");
    const authOn = (config.headers as any)?.Authorization ? "YES" : "NO";
    console.log("[axios] ->", full, "| auth?", authOn);
  }
  return config;
});

// 明示トークン差替え用（任意）
export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export default api;
