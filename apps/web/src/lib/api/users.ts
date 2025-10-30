// apps/web/src/lib/api/users.ts

import api from "@/lib/api/client";

export type UserMe = {
  id: number;
  username: string;
  email?: string | null;
  first_name?: string;
  last_name?: string;
  profile: {
    nickname?: string | null;
    is_public: boolean;
    bio?: string | null;
    icon_url?: string | null;
  };
};

export type LoginPayload = { username: string; password: string };
export type TokenPair = { access: string; refresh: string };

/** 未ログイン(401)は null を返す */
export async function getCurrentUser(signal?: AbortSignal): Promise<UserMe | null> {
  try {
    const r = await api.get<UserMe>("users/me/", { signal });
    return r.data ?? null;
  } catch {
    return null;
  }
}

/** 部分更新（サーバ仕様が profile 直下ならそのまま。必要なら { profile: payload } に） */
export async function updateUser(payload: Partial<{ nickname: string; is_public: boolean; bio: string | null }>) {
  const r = await api.patch<UserMe>("users/me/", payload);
  return r.data;
}

/** アイコン画像の更新（フィールド名はサーバ側に合わせて 'icon' などに） */
export async function updateMeIcon(file: File) {
  const form = new FormData();
  form.append("icon", file); // ← 期待キー名を要確認
  const r = await api.patch<UserMe>("users/me/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

/** ログイン（JWT）。api baseURL は /api/ なのでパスは 'auth/jwt/create/' でOK */
export async function loginUser(payload: LoginPayload): Promise<TokenPair> {
  const r = await api.post<TokenPair>("auth/jwt/create/", payload);
  return r.data;
}
