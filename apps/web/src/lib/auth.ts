// apps/web/src/lib/auth.ts
import axios from "axios";
import api, { setAuthToken, set401Handler } from "@/lib/apiClient";

// --- /api の有無を吸収して絶対URLを作る ---
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000")
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");
const ABSOLUTE_API_BASE = `${PUBLIC_BASE}/api`;

// --- パス正規化 ---
function normalizePath(raw: string) {
  let s = (raw || "").trim();
  try { const u = new URL(s); s = u.pathname; } catch {}
  if (s.startsWith("/api/")) s = s.slice(4); // "/api/xxx" → "/xxx"
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

// SimpleJWT をデフォルトに（環境で上書きOK）
const LOGIN_PATH   = normalizePath(process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH   || "/token/");
const REFRESH_PATH = normalizePath(process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH || "/token/refresh/");
const SIGNUP_PATH  = normalizePath(process.env.NEXT_PUBLIC_SIGNUP_PATH       || "/auth/signup/");

// レスポンス差異吸収
type LoginResult = {
  access?: string; access_token?: string; refresh?: string;
  key?: string; auth_token?: string; token?: string;
};
function pickAccessToken(d: LoginResult) {
  return d.access || d.access_token || d.key || d.auth_token || d.token || null;
}
function saveTokens(access: string, refresh?: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access", access);
  localStorage.setItem("access_token", access);
  if (refresh) {
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("refresh_token", refresh);
  }
  setAuthToken(access);
}

// === ログイン（絶対 → 相対でフォールバック） ===
export async function login(username: string, password: string) {
  const bodies = [{ username, password }, { email: username, password }];
  let lastErr: unknown = null;

  for (const body of bodies) {
    try {
      const r = await axios.post<LoginResult>(`${ABSOLUTE_API_BASE}${LOGIN_PATH}`, body, {
        headers: { "Content-Type": "application/json" },
      });
      const tok = pickAccessToken(r.data || {});
      if (!tok) throw new Error("No access token (abs)");
      saveTokens(tok, r.data?.refresh ?? null);
      return r.data;
    } catch (e: any) {
      lastErr = e;
      if (e?.response?.status !== 400 && e?.response?.status !== 401) break;
    }
    try {
      const r = await api.post<LoginResult>(LOGIN_PATH, body);
      const tok = pickAccessToken(r.data || {});
      if (!tok) throw new Error("No access token (rel)");
      saveTokens(tok, r.data?.refresh ?? null);
      return r.data;
    } catch (e2) {
      lastErr = e2;
    }
  }
  throw lastErr ?? new Error(`Login failed at ${LOGIN_PATH}`);
}

export function logout() {
  if (typeof window !== "undefined") {
    ["access","access_token","refresh","refresh_token"].forEach((k) => localStorage.removeItem(k));
  }
  setAuthToken(null);
}

// === 401 用：アクセストークンの自動更新 ===
export async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refresh = localStorage.getItem("refresh") || localStorage.getItem("refresh_token");
  if (!refresh) return false;

  try {
    const { data } = await axios.post<LoginResult>(`${ABSOLUTE_API_BASE}${REFRESH_PATH}`, { refresh }, {
      headers: { "Content-Type": "application/json" },
    });
    const access = pickAccessToken(data || {}) || (data as any).access;
    if (!access) return false;
    saveTokens(access, data?.refresh ?? refresh);
    return true;
  } catch {
    try {
      const { data } = await api.post<LoginResult>(REFRESH_PATH, { refresh });
      const access = pickAccessToken(data || {}) || (data as any).access;
      if (!access) return false;
      saveTokens(access, data?.refresh ?? refresh);
      return true;
    } catch {
      try {
        ["access","access_token","refresh","refresh_token"].forEach((k) => localStorage.removeItem(k));
      } catch {}
      setAuthToken(null);
      return false;
    }
  }
}

// apiClient へ 401 リフレッシュ手続きを注入
set401Handler(refreshAccessToken);

// 任意: サインアップ
export type SignupPayload = { username: string; password: string; email?: string; };
export async function signup(payload: SignupPayload) {
  const { data } = await api.post(SIGNUP_PATH, payload);
  return data;
}
