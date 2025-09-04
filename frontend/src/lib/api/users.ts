import api from "./client";

export type User = { id: number; username: string; email?: string; };

export async function getCurrentUser(): Promise<User> {
  const res = await api.get("/users/me/");
  return res.data as User;
}
