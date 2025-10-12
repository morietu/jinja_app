// apps/web/src/lib/api/users.ts
import { apiGet, apiPatch, apiPatchForm, isAuthError, apiPost } from "@/lib/api/http";

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

export async function getCurrentUser(): Promise<UserMe | null> {
  try {
    return await apiGet<UserMe>("/users/me/");
  } catch (e: any) {
    if (isAuthError(e)) return null;
    if (/Network|ECONN|Failed to fetch/i.test(String(e?.message ?? ""))) return null;
    throw e;
  }
}

export function updateUser(payload: Partial<{ nickname: string; is_public: boolean; bio: string | null }>) {
  return apiPatch<UserMe>("/users/me/", payload);
}
export function updateMeIcon(file: File) {
  const form = new FormData();
  form.append("icon", file);
  return apiPatchForm<UserMe>("/users/me/", form);
}

export async function loginUser(payload: LoginPayload): Promise<TokenPair> {
  // ← 名前を変えて衝突回避。必要なら export しない選択でもOK
  return apiPost<TokenPair>("auth/jwt/create/", payload);
}
