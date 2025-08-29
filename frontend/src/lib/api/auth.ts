import api from "./client";

export async function login(username: string, password: string) {
  const res = await api.post("/token/", { username, password });

  // トークンを保存
  localStorage.setItem("access_token", res.data.access);
  localStorage.setItem("refresh_token", res.data.refresh);
  return res.data;
}

// ✅ refresh で新しい access_token を取得
export async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;

  try {
    const res = await api.post("/token/refresh/", { refresh });
    const newAccess = res.data.access;
    localStorage.setItem("access_token", newAccess);
    return newAccess;
  } catch (err) {
    console.error("リフレッシュ失敗:", err);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    return null;
  }
}
