// apps/web/src/lib/api/client.ts
import axios from "axios";

// バックエンド直叩き用（curl とかで使うことがある）
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

// ★ フロントからは必ず Next の /api を経由する
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export default api;
