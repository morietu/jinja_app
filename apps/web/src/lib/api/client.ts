import axios from "axios";

const isServer = typeof window === "undefined";

const SELF_ORIGIN =
  process.env.APP_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT ?? "3000"}`); // ← 可能なら localhost 推奨

const baseURL = isServer ? `${SELF_ORIGIN}/api` : "/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

export default api;
