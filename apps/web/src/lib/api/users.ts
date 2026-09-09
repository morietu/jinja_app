// apps/web/src/lib/api/users.ts
/* istanbul ignore file */

// 認証状態の取得（/api/users/me/）は AuthProvider のみで扱うこと。
// このファイルはプロフィール更新用APIと、そのresponse contractだけを定義する。

export type UserProfileData = {
  nickname: string | null;
  is_public: boolean;
  bio: string | null;
  icon: string | null;
  icon_url: string | null;
  birthday: string | null;
  birth_time: string | null;
  birth_place: string | null;
  created_at: string;
};

export type UserMe = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile: UserProfileData | null;
};

export type UpdateUserProfilePayload = Partial<{
  nickname: string;
  is_public: boolean;
  bio: string | null;
  birthday: string | null;
  birth_time: string | null;
  birth_place: string;
}>;

export async function updateUser(patch: UpdateUserProfilePayload): Promise<UserMe> {
  const res = await fetch("/api/users/me/", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `updateUser failed: ${res.status}`);
  }
  const json = await res.json();
  const data = (json as { user?: UserMe }).user ?? json;
  return data as UserMe;
}
