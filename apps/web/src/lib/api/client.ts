// apps/web/src/lib/api/client.ts
import axios, { AxiosError, AxiosRequestConfig } from "axios";

declare module "axios" {
  // カスタムフラグを許可
  interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

// ── SSR/CSR で baseURL を分岐（SSRは絶対URL、CSRは相対URL） ──
const isServer = typeof window === "undefined";

const SELF_ORIGIN =
  process.env.APP_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT ?? "3000"}`);

const baseURL = isServer
  ? `${SELF_ORIGIN.replace(/\/+$/, "")}/api/`
  : "/api/";

// ここだけで api を1回だけ作る
const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

// ── 401時の自動リフレッシュ（多重リクエストは1回に集約）──
let refreshing = false;
let waiters: ((ok: boolean) => void)[] = [];

async function callRefresh(): Promise<boolean> {
  if (refreshing) {
    return new Promise((res) => waiters.push(res));
  }
  refreshing = true;
  try {
    const r = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    const ok = r.ok;
    // 溜まっている待機者へ結果を配信
    waiters.forEach((w) => w(ok));
    return ok;
  } catch {
    waiters.forEach((w) => w(false));
    return false;
  } finally {
    refreshing = false;
    waiters = [];
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const response = error.response;
    const original = error.config as AxiosRequestConfig | undefined;

    // レスポンスなし（ネットワーク系）や再試行済みは素通し
    if (!response || response.status !== 401 || !original || original._retry) {
      throw error;
    }

    // リフレッシュ試行
    const ok = await callRefresh();
    if (!ok) throw error;

    // 1回だけ再試行（httpOnly Cookie が更新済み）
    original._retry = true;
    return api.request(original);
  }
);

export default api;
