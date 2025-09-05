import { isNoAuth } from "./noauth";
// frontend/src/lib/api/client.ts
import axios, { InternalAxiosRequestConfig } from "axios";

const isServer = typeof window === "undefined";
const BASE_URL = isServer
  ? process.env.NEXT_PUBLIC_API_BASE_SERVER || "http://web:8000"
  : process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// ---- トークンキーを両対応（既存との互換維持）----
const ACCESS_KEYS = ["access_token", "access"];
const REFRESH_KEYS = ["refresh_token", "refresh"];

function getFromAny(keys: string[]) {
  if (isServer) return null;
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return { key: k, value: v };
  }
  return null;
}
function setAll(keys: string[], value: string) {
  if (isServer) return;
  keys.forEach((k) => localStorage.setItem(k, value));
}
function removeAll(keys: string[]) {
  if (isServer) return;
  keys.forEach((k) => localStorage.removeItem(k));
}

// ---- 末尾スラッシュ補正（/token系や拡張子付きは除外）----
function ensureTrailingSlash(u: string) {
  if (!u) return u;
  if (u.startsWith("/token") || u.includes(".")) return u;
  const [path, qs = ""] = u.split("?");
  if (path.endsWith("/")) return u;
  return qs ? `${path}/?${qs}` : `${path}/`;
}



// -------------------------
// リクエストインターセプター
// -------------------------
api.interceptors.request.use((config) => {
  const url = config.url || "";

  // 末尾スラッシュを標準化（/token系は除外）
  if (!url.startsWith("/token")) {
    config.url = ensureTrailingSlash(url);
  }

  // 認証不要ならそのまま
  if (isNoAuth(url)) return config;

  // Authorization 付与（両対応キー）
  const tk = getFromAny(ACCESS_KEYS);
  if (tk) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${tk.value}`;
  }
  return config;
});

// -------------------------
// レスポンスインターセプター（401→refresh→再送）
// -------------------------
let isRefreshing = false;
let waitQueue: Array<(t: string) => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    const original: (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined = error?.config;

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }
    if ((original.url || "").startsWith("/token")) {
      return Promise.reject(error);
    }

    // すでに refresh 中なら待ってから再送
    if (isRefreshing) {
      const newToken = await new Promise<string>((resolve) => waitQueue.push(resolve));
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newToken}`;
      original._retry = true;
      return api(original);
    }

    isRefreshing = true;
    original._retry = true;

    try {
      if (isServer) throw error;

      const r = getFromAny(REFRESH_KEYS);
      if (!r) throw error;

      const { data } = await axios.post(
        `${api.defaults.baseURL}/api/token/refresh/`,
        { refresh: r.value }
      );

      const newAccess: string = data.access;
      if (!newAccess) throw new Error("No access token from refresh");

      // 新 access を全キーに保存
      setAll(ACCESS_KEYS, newAccess);

      // 待機中のリクエストを再開
      waitQueue.forEach((fn) => fn(newAccess));
      waitQueue = [];

      // 元リクエストを再送
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (e) {
      // 失敗時はトークンを全削除してログインへ
      removeAll(ACCESS_KEYS);
      removeAll(REFRESH_KEYS);
      if (!isServer && typeof window !== "undefined") window.location.href = "/login";
      throw e;
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
