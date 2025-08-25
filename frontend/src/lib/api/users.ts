import api from "./client";

export type User = {
  id: number;
  nickname: string;
  is_public: boolean;
};

export async function getCurrentUser(): Promise<User> {
  const res = await api.get("/users/me/");
  return res.data;
}

export async function updateUser(data: Partial<User>): Promise<User> {
  const res = await api.patch("/users/me/", data);
  return res.data;
}
