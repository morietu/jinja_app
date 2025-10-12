// apps/web/src/lib/api/auth.ts
import { apiPost } from "@/lib/api/http";

export type LoginPayload = { username: string; password: string };
export type TokenPair   = { access: string; refresh: string };

export async function login(payload: LoginPayload | [string, string]): Promise<TokenPair> {
  const body = Array.isArray(payload)
    ? { username: payload[0], password: payload[1] }
    : payload;
  return apiPost<TokenPair>("auth/jwt/create/", body);
}

export async function refreshToken(refresh: string): Promise<{ access: string }> {
  return apiPost<{ access: string }>("auth/jwt/refresh/", { refresh });
}

export async function verifyToken(token: string): Promise<Record<string, unknown>> {
  return apiPost("auth/jwt/verify/", { token });
}

// 使っているので実装しておく
export async function signup(payload: { username: string; password: string; email?: string }) {
  // サインアップAPIが別にあるならそちらへ。なければ一旦 501 を返すか TODO コメントでもOK
  return apiPost<any>("users/signup/", payload);
}

// hooks/useAuth.ts から呼ばれている想定
export async function logout(): Promise<void> {
  try {
    // サーバーにブラックリスト化APIがあれば叩く（任意）
    // await apiPost("auth/jwt/blacklist/", { refresh });
  } catch { /* no-op */ }
  // トークン破棄は呼び出し側に任せるなら何もしないでもOK
}
