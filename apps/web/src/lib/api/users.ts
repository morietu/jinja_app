// apps/web/src/lib/api/users.ts
import { apiGet, apiPatch, apiPatchForm, isAuthError } from "@/lib/api/http";

export type UserMe = {
  id: number;
  username: string;
  email?: string | null;
  first_name?: string;
  last_name?: string;
  profile: { nickname?: string | null; is_public: boolean };
};

export async function getCurrentUser(): Promise<UserMe | null> {
  try {
    return await apiGet<UserMe>("/users/me/");   // DRF は末尾スラ必須
  } catch (e: any) {
    // 未ログイン（401）やネットワーク系は null 扱い
    if (isAuthError(e)) return null;
    if (e?.isAxiosError && !e?.response) return null; // ネットワーク層
    throw e; // それ以外は本当のエラー
  }
}

export async function updateUser(payload: Partial<{ nickname: string; is_public: boolean; bio: string | null }>) {
  return apiPatch<UserMe>("/users/me/", payload);
}

export async function updateMeIcon(file: File) {
  const form = new FormData();
  form.append("icon", file);
  return apiPatchForm<UserMe>("/users/me/", form);
}
