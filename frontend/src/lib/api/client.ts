import axios, { InternalAxiosRequestConfig } from "axios";

const isServer = typeof window === "undefined";
const BASE_URL = isServer
  ? process.env.NEXT_PUBLIC_API_BASE_SERVER || "http://web:8000/api"
  : process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

// 認証不要APIの除外
const isNoAuth = (url: string) =>
  url.startsWith("/shrines") ||
  url.startsWith("/goriyaku-tags") ||
  url.startsWith("/ranking") ||
  url === "/concierge" ||
  url.startsWith("/token"); // /token/, /token/refresh/

api.interceptors.request.use((config) => {
  const url = config.url || "";
  if (isNoAuth(url)) return config;

  if (!isServer) {
    const token = window.localStorage.getItem(ACCESS_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 401→refresh→再送（多重refreshを抑止）
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
      const refresh = window.localStorage.getItem(REFRESH_KEY);
      if (!refresh) throw error;

      const { data } = await axios.post(`${api.defaults.baseURL}/token/refresh/`, { refresh });
      const newAccess: string = data.access;
      if (!newAccess) throw new Error("No access token from refresh");

      window.localStorage.setItem(ACCESS_KEY, newAccess);
      waitQueue.forEach((fn) => fn(newAccess));
      waitQueue = [];

      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (e) {
      if (!isServer) {
        window.localStorage.removeItem(ACCESS_KEY);
        window.localStorage.removeItem(REFRESH_KEY);
        if (typeof window !== "undefined") window.location.href = "/login";
      }
      throw e;
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;