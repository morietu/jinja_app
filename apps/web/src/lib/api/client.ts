// apps/web/src/lib/api/client.ts
import axios from "axios";

const isServer = typeof window === "undefined";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: isServer
    ? process.env.API_BASE_SERVER || process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000" // サーバー側（Node）から呼ぶとき
    : "/api", // ★ ブラウザは必ず /api 経由
  withCredentials: true,
});

// ここに既存の interceptors があればそのまま残す

export default api;
