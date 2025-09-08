import axios from "axios";

// SSRかどうか
const isServer = typeof window === "undefined";

// SSRでは API_BASE_SERVER を優先、CSRでは NEXT_PUBLIC_API_BASE を使う
const BASE =
  (isServer ? process.env.API_BASE_SERVER : process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8000";

export const api = axios.create({ baseURL: BASE });

/** 認証ヘッダの付け外し（ログイン後に呼ぶ） */
export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}
