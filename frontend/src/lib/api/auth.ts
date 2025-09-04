import api from "./client";

export async function login(username: string, password: string) {
  const res = await api.post("/token/", { username, password });
  localStorage.setItem("access_token", res.data.access ?? "");
  localStorage.setItem("refresh_token", res.data.refresh ?? "");
  return res.data;
}

export async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) throw new Error("No refresh token");
  const res = await api.post("/token/refresh/", { refresh });
  localStorage.setItem("access_token", res.data.access ?? "");
  return res.data;
}
