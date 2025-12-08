// apps/web/src/lib/api/mypage.ts
import { apiGet, apiPatch } from "./http";
import type { AxiosRequestConfig } from "axios";
import type { Goshuin as GoshuinFromGoshuinApi } from "./goshuin";
import { fetchMyGoshuin as fetchMyGoshuinFromGoshuin } from "./goshuin";

// 型は実際のレスポンスに合わせて
export type MeResponse = {
  user: {
    id: number;
    username: string;
    email: string;
    nickname: string;
    is_public: boolean;
    bio: string | null;
    icon: string | null;
    created_at: string;
    profile: {
      nickname: string;
      is_public: boolean;
      bio: string | null;
      birthday: string | null;
      location: string | null;
    };
  } | null;
};

export type UpdateProfilePayload = {
  nickname?: string;
  website?: string | null;
  icon_url?: string | null;
  birthday?: string | null; // "YYYY-MM-DD"
  location?: string | null;
  is_public?: boolean;
};

export type Goshuin = GoshuinFromGoshuinApi;

export async function fetchMe(config?: AxiosRequestConfig) {
  return apiGet<MeResponse>("/users/me/", config);
}

export async function fetchMyGoshuin(_config?: AxiosRequestConfig) {
  // config を使っていないなら、そのまま透過でOK
  return fetchMyGoshuinFromGoshuin();
}

export async function updateProfileVisibility(isPublic: boolean): Promise<void> {
  // 例: /api/my/profile/ で PATCH する想定
  await apiPatch("/my/profile/", { is_public: isPublic });
}



export async function updateProfile(data: UpdateProfilePayload) {
  return apiPatch("/my/profile/", data);
}
