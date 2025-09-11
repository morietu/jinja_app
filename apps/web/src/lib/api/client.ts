import axios, { InternalAxiosRequestConfig } from "axios";

const isServer = typeof window === "undefined";

// 末尾スラッシュ除去
const strip = (s?: string | null) => (s ? s.replace(/\/$/, "") : undefined);

// CSR: "/api"（Next rewrites） / SSR: 絶対URL+"/api"
const PUBLIC_BASE = strip(process.env.NEXT_PUBLIC_API_BASE);
const SERVER_BASE = strip(process.env.API_BASE_SERVER);
const baseURL = isServer
  ? `${SERVER_BASE ?? PUBLIC_BASE ?? "http://localhost:8000"}/api`
  : "/api";

const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// ===== 認証ヘルパ =====
export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

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

// /token 系は末尾スラッシュ操作しない
function ensureTrailingSlash(u?: string) {
  if (!u) return u;
  if (u.startsWith("/token") || u.startsWith("/auth")) return u;
  const [path, qs = ""] = u.split("?");
  if (path.endsWith("/")) return u;
  return qs ? `${path}/?${qs}` : `${path}/`;
}

// ===== リクエスト: 末尾スラッシュ & Authorization 自動付与 =====
api.interceptors.request.use((config) => {
  const url = config.url || "";
  config.url = ensureTrailingSlash(url);

  // Authorization 未設定なら localStorage から付与
  const hasAuth =
    !!(config.headers as any)?.Authorization ||
    !!api.defaults.headers.common["Authorization"];
  if (!hasAuth) {
    const tk = getFromAny(ACCESS_KEYS);
    if (tk) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${tk.value}`;
    }
  }
  return config;
});

// ===== レスポンス: 401 -> refresh -> リトライ =====
let refreshing = false;
let waiters: Array<(t: string) => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    const original: (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined = error?.config;

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }
    // 認証系自体はリトライしない
    const url = original.url || "";
    if (url.startsWith("/token") || url.startsWith("/auth")) {
      return Promise.reject(error);
    }

    if (refreshing) {
      const newTok = await new Promise<string>((resolve) => waiters.push(resolve));
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newTok}`;
      original._retry = true;
      return api(original);
    }

    refreshing = true;
    original._retry = true;

    try {
      // CSR 以外はリフレッシュしない（基本CSR前提）
      if (typeof window === "undefined") throw error;

      const r = getFromAny(REFRESH_KEYS);
      if (!r) throw error;

      // 相対パスで OK（Next rewrites 経由）
      const { data } = await axios.post("/api/token/refresh/", { refresh: r.value });

      const newAccess: string | undefined = data?.access;
      if (!newAccess) throw new Error("No access token from refresh");

      // 保存＆キュー解放
      setAll(ACCESS_KEYS, newAccess);
      api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;
      waiters.forEach((fn) => fn(newAccess));
      waiters = [];

      // 元リクエスト再送
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (e) {
      // 失敗時は破棄してログインへ
      removeAll(ACCESS_KEYS);
      removeAll(REFRESH_KEYS);
      if (typeof window !== "undefined") window.location.href = "/login";
      throw e;
    } finally {
      refreshing = false;
    }
  }
);

export default api;
