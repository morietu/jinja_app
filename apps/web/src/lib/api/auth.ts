import axios from "axios";
import api, { setAuthToken } from "./client";

type LoginResult = {
  access?: string;
  access_token?: string;   // ← 追加
  refresh?: string;
  key?: string;
  auth_token?: string;
  token?: string;
};

// 先頭/末尾スラッシュを揃える
function normalizePath(raw: string) {
  let s = (raw || "").trim();
  try { const u = new URL(s); s = u.pathname; } catch {}
  if (s.startsWith("/api/")) s = s.slice(4);
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

// env で差し替え可能に（すべて normalize）
const LOGIN_PATH   = normalizePath(process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH   || "/token/");
const REFRESH_PATH = normalizePath(process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH || "/token/refresh/");
const SIGNUP_PATH  = normalizePath(process.env.NEXT_PUBLIC_SIGNUP_PATH       || "/auth/signup/");

function pickAccessToken(data: LoginResult) {
  // 返却フォーマットの揺れを吸収
  return data.access || data.access_token || data.key || data.auth_token || data.token || null;
}

function saveTokens(access: string, refresh?: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", access);
  localStorage.setItem("access", access);
  if (refresh) {
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("refresh", refresh);
  }
  setAuthToken(access);
}

export async function login(username: string, password: string) {
  const bodies = [{ username, password }, { email: username, password }];
  let lastErr: unknown = null;

  for (const body of bodies) {
    // 1) まずバックエンド直叩き（絶対URL）
    try {
      const absUrl = `${PUBLIC_BASE}/api${LOGIN_PATH}`;
      const r = await axios.post<LoginResult>(absUrl, body, {
        headers: { "Content-Type": "application/json" },
      });
      const tok = pickAccessToken(r.data || {});
      if (!tok) throw new Error("No access token in response (abs)");
      saveTokens(tok, r.data?.refresh ?? null);
      return r.data;
    } catch (e) {
      lastErr = e;
      if (axios.isAxiosError(e) && (e.response?.status === 400 || e.response?.status === 401)) {
        continue;
      }
      // その他は相対で再試行
    }

    // 2) 相対 /api（Next rewrites 経由）
    try {
      const res = await api.post<LoginResult>(LOGIN_PATH, body);
      const tok = pickAccessToken(res.data || {});
      if (!tok) throw new Error("No access token in response (rel)");
      saveTokens(tok, res.data?.refresh ?? null);
      return res.data;
    } catch (e2) {
      lastErr = e2;
      if (axios.isAxiosError(e2) && (e2.response?.status === 400 || e2.response?.status === 401)) {
        continue;
      }
    }
  }
  throw lastErr ?? new Error(`Login failed at ${LOGIN_PATH}`);
}

export function logout() {
  if (typeof window !== "undefined") {
    ["access_token", "access", "refresh_token", "refresh"].forEach((k) => localStorage.removeItem(k));
  }
  setAuthToken(null);
}

// === refreshAccessToken: リフレッシュトークンで Access を再発行 ===
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refresh = localStorage.getItem("refresh_token") || localStorage.getItem("refresh");
  if (!refresh) return null;

  // 1) 相対 /api
  try {
    const r = await api.post<LoginResult>(REFRESH_PATH, { refresh });
    const access = pickAccessToken(r.data || {});
    if (!access) return null;
    saveTokens(access, r.data?.refresh ?? refresh);
    return access;
  } catch {
    // 2) 絶対URL
    try {
      const abs = `${PUBLIC_BASE}/api${REFRESH_PATH}`;
      const r2 = await axios.post<LoginResult>(abs, { refresh }, { headers: { "Content-Type": "application/json" } });
      const access = pickAccessToken(r2.data || {});
      if (!access) return null;
      saveTokens(access, r2.data?.refresh ?? refresh);
      return access;
    } catch {
      ["access_token", "access", "refresh_token", "refresh"].forEach((k) => localStorage.removeItem(k));
      setAuthToken(null);
      return null;
    }
  }
}

export type SignupPayload = {
  username: string;
  password: string;
  email?: string;
};

/** サインアップ（バックエンドの実装に合わせて path を調整してください） */
export async function signup(payload: SignupPayload) {
  const { data } = await api.post(SIGNUP_PATH, payload);
  return data;
}
