// apps/web/src/lib/api/users.ts
/* istanbul ignore file */
import api from "@/lib/api/client";

export type UpdateMePayload = Partial<{
  nickname: string;
  is_public: boolean;
  website: string;
  icon_url: string;
  birthday: string; // yyyy-mm-dd or ISO
  location: string;
}>;

export async function updateMe(payload: UpdateMePayload) {
  const { data } = await api.patch("users/me/", payload);
  return data;
}

export async function uploadUserIcon(file: File): Promise<{ icon_url: string }> {
  const formData = new FormData();
  formData.append("icon", file);

  const { data } = await api.post<{ icon_url: string }>("my/profile/icon/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data;
}

export type UserMe = {
  id: number;
  username: string;
  email: string;
  nickname: string;
  is_public: boolean;
  bio: string | null;
  icon: string | null;
  created_at: string;
  // ★ ここを追加
  website?: string | null;
  profile: {
    nickname: string | null;
    is_public: boolean;
    bio: string | null;
    birthday?: string | null;
    location?: string | null;
    // ★ プロフィール側に website が入る可能性も見ておく
    website?: string | null;
  } | null;
};

// ここ以下はそのままでOK
export async function getCurrentUser(signal?: AbortSignal): Promise<UserMe | null> {
  const res = await fetch("/api/users/me/", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `getCurrentUser failed: ${res.status}`);
  }

  const json = await res.json();
  const data = (json as any).user ?? json;
  return data as UserMe;
}

export async function updateUser(patch: Partial<UserMe>): Promise<UserMe> {
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
  const data = (json as any).user ?? json;
  return data as UserMe;
}
