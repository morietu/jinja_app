import api from "./client";

export type User = {
  id: number;
  username: string;
  nickname: string;
  bio?: string | null;
  icon?: string | null;
  is_public: boolean;
  created_at: string;
};

// 現在のユーザー情報取得
export async function getCurrentUser(): Promise<User> {
  const res = await api.get("/users/me/");
  return res.data;
}

// ユーザー情報更新
export async function updateUser(data: Partial<User>): Promise<User> {
  const res = await api.patch("/users/me/", data);
  return res.data;
}
