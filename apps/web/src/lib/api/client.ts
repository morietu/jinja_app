// apps/web/src/lib/api/client.ts
import axios from "axios";

const isServer = typeof window === "undefined";
const SELF_ORIGIN =
  process.env.APP_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://127.0.0.1:${process.env.PORT ?? "3000"}`);

const baseURL = isServer ? `${SELF_ORIGIN}/api` : "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

export default api;

if (process.env.NODE_ENV !== "production") {
  // 動作確認ログ
  // eslint-disable-next-line no-console
  console.debug("[api] baseURL =", baseURL, "isServer =", isServer);
}
