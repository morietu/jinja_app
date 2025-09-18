// apps/web/lib/auth.ts
import api from "./apiClient";
import { setAuthToken } from "./apiClient";

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  setAuthToken(access);
}
export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  setAuthToken(null);
}

export async function login(username: string, password: string) {
  // baseURL が /api なので、相対で "token/" を叩けば /api/token/
  const { data } = await api.post("token/", { username, password });
  saveTokens(data.access, data.refresh);
  return data;
}

export async function refreshAccess() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token なし");
  const r = await axios.post("/api/token/refresh/", { refresh: refreshToken });
  const { access } = r.data || {};
  if (!access) throw new Error("access 再発行に失敗");
  localStorage.setItem(ACCESS_KEY, data.access);
  setAuthToken(access);
  return access;
}

export function logout() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  setAuthToken(null);
}
export function isLoggedIn() {
  return !!getAccessToken();
}
