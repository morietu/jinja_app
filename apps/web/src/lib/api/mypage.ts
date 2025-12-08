// apps/web/src/lib/api/mypage.ts
import { apiGet, apiPatch, apiPost } from "./http";
import type { AxiosRequestConfig } from "axios";
import type { Goshuin as GoshuinFromGoshuinApi } from "./goshuin";
import { fetchMyGoshuin as fetchMyGoshuinFromGoshuin } from "./goshuin";
import { uploadUserIcon } from "./users";

export type MeProfile = {
  nickname: string;
  is_public: boolean;
  bio: string | null;
  // ここはバックエンドにまだ無いから「あとで追加予定」なら optional にしておく
  birthday?: string | null;
  location?: string | null;
  website?: string | null;
};

export type MeResponse = {
  id: number;
  username: string;
  email: string;
  nickname: string;
  is_public: boolean;
  bio: string | null;
  icon: string | null;
  created_at: string;
  profile: MeProfile | null;
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
  // ✅ Next の /api/my/profile/ 経由で Django /api/users/me/ に届く
  return apiGet<MeResponse>("/my/profile/", config);
}

export async function fetchMyGoshuin(_config?: AxiosRequestConfig) {
  return fetchMyGoshuinFromGoshuin();
}

export async function updateProfileVisibility(isPublic: boolean): Promise<void> {
  // ✅ フロントから見ると /api/my/profile/ を叩くだけ
  await apiPatch("/my/profile/", { is_public: isPublic });
}

export async function updateProfile(data: UpdateProfilePayload) {
  const payload: any = {};

  if (data.nickname !== undefined) {
    payload.nickname = data.nickname;
  }
  if (data.is_public !== undefined) {
    payload.is_public = data.is_public;
  }

  // website / birthday / location などは
  // backend の MeSerializer / UserProfileSerializer に合わせて足していく
  if (data.website !== undefined) {
    payload.website = data.website;
  }
  if (data.birthday !== undefined) {
    payload.birthday = data.birthday;
  }
  if (data.location !== undefined) {
    payload.location = data.location;
  }
  if (data.icon_url !== undefined) {
    payload.icon_url = data.icon_url;
  }

  return apiPatch("/my/profile/", payload);
}

export async function uploadProfileIcon(file: File) {
  // 中身は共通関数に丸投げ
  return uploadUserIcon(file);
}
