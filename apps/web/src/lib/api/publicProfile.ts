// apps/web/src/lib/api/publicProfile.ts
import { apiGet } from "./http";

export type PublicProfile = {
  username: string;
  nickname: string;
  website: string | null;
  icon_url: string | null;
  bio: string | null;
  birthday: string | null;
  location: string | null;
  is_public: boolean;
};

export async function fetchPublicProfile(username: string): Promise<PublicProfile> {
  const r = await apiGet<{ data: PublicProfile }>(`/public/profile/${username}/`);
  return r.data;
}
