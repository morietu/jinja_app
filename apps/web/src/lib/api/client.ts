// apps/web/src/lib/api/client.ts
import axios from "axios";

// バックエンド直叩き用（curl とかで使うことがある）
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

// ★ フロントからは必ず Next の /api を経由する
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// ここでは Authorization は付けない（HttpOnly クッキーのため JS から読めない）
export default api;

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();

  // GET/HEAD/OPTIONS 以外だけ CSRF を付ける
  if (!["get", "head", "options"].includes(method)) {
    const token = getCookie("csrftoken");
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any)["X-CSRFToken"] = token;
    }
  }
  return config;
});
