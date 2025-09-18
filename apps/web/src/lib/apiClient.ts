// apps/web/src/lib/apiClient.ts
import axios from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE.replace(/\/+$/, ""), // 末尾スラッシュ除去
});

// 現在のアクセストークンを保持（SSR安全）
let currentToken: string | null = null;
export function setAuthToken(token: string | null) {
  currentToken = token;
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

// auth.ts から注入される 401 ハンドラ（循環依存を回避）
let on401: (() => Promise<boolean>) | null = null;
export function set401Handler(handler: () => Promise<boolean>) {
  on401 = handler;
}

// 401 が来たら 1 回だけリフレッシュして再試行
let refreshing: Promise<boolean> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err.response?.status;
    const cfg = err.config;

    if (status === 401 && on401 && !cfg?._retried) {
      if (!refreshing) refreshing = on401().finally(() => (refreshing = null));
      const ok = await refreshing;
      if (ok) {
        cfg._retried = true;
        // setAuthToken が内部で defaults を更新している前提
        return api(cfg);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
