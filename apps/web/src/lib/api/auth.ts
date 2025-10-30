// apps/web/src/lib/api/auth.ts
import api from "@/lib/api/client";
import { tokens } from "@/lib/auth/token";

export type LoginPayload = { username: string; password: string };
export type TokenPair   = { access: string; refresh: string };

export async function loginUser(payload: LoginPayload): Promise<TokenPair> {
  const r = await api.post<TokenPair>("auth/jwt/create/", payload);
  tokens.set(r.data.access, r.data.refresh);
  return r.data;
}

// 互換エクスポート（他の箇所の import { login } を壊さない）
export const login = loginUser;

// 他はそのまま（必要なら）
export async function refreshToken(refresh: string) {
  const r = await api.post<{ access: string }>("auth/jwt/refresh/", { refresh });
  return r.data;
}
export async function verifyToken(token: string) {
  const r = await api.post("auth/jwt/verify/", { token });
  return r.data as Record<string, unknown>;
}
