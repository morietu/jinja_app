import api from "./client";

export async function login(username: string, password: string) {
  const res = await api.post("/token/", { username, password });

  // トークンを保存
  localStorage.setItem("access_token", res.data.access);
  localStorage.setItem("refresh_token", res.data.refresh);
  return res.data;
}
