import type { AxiosInstance } from "axios";

export type User = { id: number; username: string; email?: string };
export type UserProfile = User & {
  display_name?: string | null;
  avatar_url?: string | null;
  home_location?: { lat: number; lng: number } | null;
};

export function usersApi(api: AxiosInstance) {
  return {
    async me() {
      const { data } = await api.get<UserProfile>("/users/me/");
      return data;
    },
    async update(payload: Partial<Omit<UserProfile, "id" | "username">>) {
      const { data } = await api.patch<UserProfile>("/users/me/", payload);
      return data;
    },
  };
}
