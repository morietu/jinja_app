// apps/web/src/lib/api/users.ts
import axios from "axios";
import api from "./client";

/** 最小のユーザー型（既存互換） */
export type User = { id: number; username: string; email?: string };

/** 拡張プロフィール */
export type UserProfile = User & {
  display_name?: string | null;
  avatar_url?: string | null;
  home_location?: { lat: number; lng: number } | null;
};

// 先頭/末尾スラッシュを保証（/api は付けない方針）
function normalizePath(p: string) {
  let s = (p || "").trim();
  try {
    // フルURLが来たら pathname のみ抽出
    const u = new URL(s);
    s = u.pathname;
  } catch {}
  if (s.startsWith("/api/")) s = s.slice(4); // 二重 /api を防止
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const ENV_PATH_RAW = process.env.NEXT_PUBLIC_AUTH_USER_PATH || "/users/me/";
const ENV_PATH = normalizePath(ENV_PATH_RAW);

// 候補（rewrite 不要な相対パス想定。絶対URLはフォールバックで作る）
const CANDIDATES = [ENV_PATH, "/users/me/", "/auth/user/", "/auth/users/me/"]
  .map(normalizePath)
  .filter((v, i, a) => a.indexOf(v) === i);

// これらのステータスは「存在する」とみなす
const EXISTS_STATUS = new Set<number>([200, 201, 202, 204, 301, 302, 307, 308, 401, 403, 405]);

let USER_ENDPOINT_CACHE: string | null = null;

// Authorization を絶対URL呼び出しにも付ける
function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const tk = localStorage.getItem("access_token") || localStorage.getItem("access");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
}

// 相対→絶対URLの順に探る
async function tryProbe(path: string): Promise<"exists" | "notfound" | "retry"> {
  const rel = path; // 例: /users/me/
  try {
    await api.get(rel);
    return "exists";
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const code = err.response?.status;
      if (code && EXISTS_STATUS.has(code)) return "exists";
      if (code === 404) {
        // 絶対URLでも 404 なら notfound 扱い
        try {
          const abs = `${PUBLIC_BASE}/api${rel}`;
          await axios.get(abs, { headers: authHeaders() });
          return "exists";
        } catch (ee: any) {
          if (axios.isAxiosError(ee) && ee.response?.status === 404) return "notfound";
          return "retry";
        }
      }
      return "retry";
    }
    return "retry";
  }
}

/** ユーザー情報エンドポイントを解決（ENV優先・フォールバックあり） */
export async function resolveUserEndpoint(): Promise<string> {
  if (USER_ENDPOINT_CACHE) return USER_ENDPOINT_CACHE;

  for (const p of CANDIDATES) {
    const r = await tryProbe(p);
    if (r === "exists") {
      USER_ENDPOINT_CACHE = p;
      return p;
    }
  }

  // 最後の最後に /users/me/ をデフォルトに
  USER_ENDPOINT_CACHE = "/users/me/";
  if (typeof window !== "undefined") {
    console.warn("[users] no endpoint confirmed; using default /users/me/");
  }
  return USER_ENDPOINT_CACHE;
}

/** 自分のプロフィール取得（401/403/404/ネットワーク系は null を返す） */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const ep = await resolveUserEndpoint();
  // 1) 相対 /api 経由（rewrite）
  try {
    const res = await api.get<UserProfile>(ep);
    return res.data;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const code = err.response?.status;
      if (code === 401 || code === 403 || code === 404) return null;
    }
  }
  // 2) 絶対URL（バックエンド直）
  try {
    const abs = `${PUBLIC_BASE}/api${ep}`;
    const res = await axios.get<UserProfile>(abs, { headers: authHeaders() });
    return res.data;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const code = err.response?.status;
      if (code === 401 || code === 403 || code === 404) return null;
    }
    console.warn("getCurrentUser: network/server error", err);
    return null;
  }
}

/** 互換API名 */
export const getMe = getCurrentUser;

/** プロフィール更新（部分更新・相対→絶対の順で試行） */
export type UpdateUserInput = Partial<Omit<UserProfile, "id" | "username">>;

export async function updateUser(payload: UpdateUserInput): Promise<UserProfile> {
  const ep = await resolveUserEndpoint();
  try {
    const res = await api.patch<UserProfile>(ep, payload);
    return res.data;
  } catch {
    const abs = `${PUBLIC_BASE}/api${ep}`;
    const res = await axios.patch<UserProfile>(abs, payload, {
      headers: { "Content-Type": "application/json", ...authHeaders() },
    });
    return res.data;
  }
}
