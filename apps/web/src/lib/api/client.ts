// apps/web/src/lib/api/client.ts
import axios from "axios";
import { getCookie, setCookie, isExpiringSoon } from "./authTokens";

// バックエンド直叩き用（curl とかで使うことがある）
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

// ★ フロントからは必ず Next の /api を経由する
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  // refresh の多重発火を防ぐ
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getCookie("refresh_token");
      if (!refresh) throw new Error("no refresh_token");

      // BFF 経由で refresh（BFF/Backend 側の仕様に合わせて body を送る）
      const res = await fetch("/api/auth/jwt/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) throw new Error("refresh failed");

      const data = (await res.json()) as { access?: string };
      if (data.access) {
        // ※HttpOnly 運用ならここは不要（setCookie できない/意味がない）
        // ただ、現状 document.cookie に access_token が見えてる前提の実装なので残す
        setCookie("access_token", data.access);
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * 1) CSRF を付与（GET/HEAD/OPTIONS 以外）
 */
api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();

  if (!["get", "head", "options"].includes(method)) {
    const token = getCookie("csrftoken");
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any)["X-CSRFToken"] = token;
    }
  }
  return config;
});

/**
 * 2) 事前 refresh（exp が近い場合）
 * 3) Authorization を付与（access_token が読める運用の場合）
 */
api.interceptors.request.use(async (config) => {
  const access = getCookie("access_token");

  if (access && isExpiringSoon(access, 60)) {
    try {
      await refreshAccessToken();
    } catch {
      // 事前refresh失敗でも握る（401リトライに任せる）
    }
  }

  const nextAccess = getCookie("access_token");
  if (nextAccess) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${nextAccess}`;
  }

  return config;
});

/**
 * 4) 401 を 1回だけ refresh→retry
 */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config as any;

    if (status !== 401 || !original || original.__retried) {
      throw error;
    }

    original.__retried = true;

    try {
      await refreshAccessToken();

      const nextAccess = getCookie("access_token");
      if (nextAccess) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${nextAccess}`;
      }

      return api.request(original);
    } catch {
      throw error;
    }
  },
);

export default api;
