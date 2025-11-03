// apps/web/src/lib/api/auth.ts
import api from "./client";

export type LoginInput = { username: string; password: string };

/** Next.js API ルート経由の login（本体） */
export async function login(body: LoginInput): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `login failed: ${res.status}`);
  }
}

/** 互換ラッパ（既存の login(username, password) 呼び出し用） */
export async function loginApi(
  username: string,
  password: string
): Promise<void> {
  return login({ username, password });
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => {});
}

/** サインアップは DRF を直叩き */
export async function signup(payload: {
  username: string;
  password: string;
  email?: string;
}) {
  const r = await api.post("/auth/users/", payload);
  return r.data;
}
