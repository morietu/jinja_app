// apps/web/src/lib/api/users.ts
import axios from "axios";
import api from "@/lib/apiClient";

/** ユーザー最小型（互換用） */
export type User = {
  id: number;
  username: string;
  email?: string | null;
};

/** 実体プロフィール型（バックエンド寄せ） */
export type UserProfile = User & {
  nickname: string;
  is_public: boolean;
  bio?: string | null;
  icon?: string | null;
  created_at?: string; // なくても動くよう optional
};

/** 更新入力型（id/username/created_at は更新しない） */
export type UpdateUserInput = Partial<
  Omit<UserProfile, "id" | "username" | "created_at">
>;

/* ==============================
   設定/ユーティリティ
================================*/
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000")
  .replace(/\/$/, "");

const ENV_PATH_RAW = process.env.NEXT_PUBLIC_AUTH_USER_PATH || "/users/me/";

/** 先頭/末尾スラッシュを保証（/api は付けない方針） */
function normalizePath(p: string) {
  let s = (p || "").trim();
  try {
    // フルURLなら pathname のみに落とす
    const u = new URL(s);
    s = u.pathname;
  } catch {
    /* noop */
  }
  if (s.startsWith("/api/")) s = s.slice(4); // /api 二重防止
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

const ENV_PATH = normalizePath(ENV_PATH_RAW);

// 候補（Rewrite ありそうな順）
const CANDIDATES = [ENV_PATH, "/users/me/", "/auth/user/", "/auth/users/me/"]
  .map(normalizePath)
  .filter((v, i, a) => a.indexOf(v) === i);

const EXISTS_STATUS = new Set<number>([
  200, 201, 202, 204, 301, 302, 307, 308, 401, 403, 405,
]);

let USER_ENDPOINT_CACHE: string | null = null;

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const tk =
    localStorage.getItem("access_token") || localStorage.getItem("access");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
}

/** 相対→絶対で「存在」判定を行う */
async function tryProbe(path: string): Promise<"exists" | "notfound" | "retry"> {
  try {
    await api.get(path);
    return "exists";
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = err.response?.status;
      if (code && EXISTS_STATUS.has(code)) return "exists";
      if (code === 404) {
        try {
          const abs = `${PUBLIC_BASE}/api${path}`;
          await axios.get(abs, { headers: authHeaders() });
          return "exists";
        } catch (ee) {
          if (axios.isAxiosError(ee) && ee.response?.status === 404) {
            return "notfound";
          }
          return "retry";
        }
      }
      return "retry";
    }
    return "retry";
  }
}

/** ユーザー情報エンドポイント決定（ENV優先、フォールバックあり） */
export async function resolveUserEndpoint(): Promise<string> {
  if (USER_ENDPOINT_CACHE) return USER_ENDPOINT_CACHE;
  for (const p of CANDIDATES) {
    const r = await tryProbe(p);
    if (r === "exists") {
      USER_ENDPOINT_CACHE = p;
      return p;
    }
  }
  USER_ENDPOINT_CACHE = "/users/me/";
  if (typeof window !== "undefined") {
    console.warn("[users] no endpoint confirmed; using default /users/me/");
  }
  return USER_ENDPOINT_CACHE;
}

/* ==============================
   API 本体
================================*/

/** 自分のプロフィール取得（401/403/404 は null 返し） */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const ep = await resolveUserEndpoint();

  // 1) 相対（/api 経由）
  try {
    const res = await api.get<UserProfile>(ep);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = err.response?.status;
      if (code === 401 || code === 403 || code === 404) return null;
    }
  }

  // 2) 絶対（バックエンド直）
  try {
    const abs = `${PUBLIC_BASE}/api${ep}`;
    const res = await axios.get<UserProfile>(abs, { headers: authHeaders() });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const code = err.response?.status;
      if (code === 401 || code === 403 || code === 404) return null;
    }
    console.warn("getCurrentUser: network/server error", err);
    return null;
  }
}

/** 互換名 */
export const getMe = getCurrentUser;

/** プロフィール更新
 *  - 相対URLで PATCH → 405 の場合 PUT
 *  - ダメなら絶対URLで同じ手順を再試行
 */
export async function updateUser(
  payload: UpdateUserInput
): Promise<UserProfile> {
  const ep = await resolveUserEndpoint();

  // 1) 相対
  try {
    try {
      const r = await api.patch<UserProfile>(ep, payload);
      return r.data;
    } catch (err: any) {
      if (err?.response?.status === 405) {
        const r2 = await api.put<UserProfile>(ep, payload);
        return r2.data;
      }
      throw err;
    }
  } catch {
    // 2) 絶対
    const abs = `${PUBLIC_BASE}/api${ep}`;
    const headers = { "Content-Type": "application/json", ...authHeaders() };

    try {
      const r = await axios.patch<UserProfile>(abs, payload, { headers });
      return r.data;
    } catch (err: any) {
      if (err?.response?.status === 405) {
        const r2 = await axios.put<UserProfile>(abs, payload, { headers });
        return r2.data;
      }
      throw err;
    }
  }
}
