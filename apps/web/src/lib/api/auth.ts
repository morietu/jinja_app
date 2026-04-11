// apps/web/src/lib/api/auth.ts

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

/** 互換ラッパ */
export async function loginApi(username: string, password: string): Promise<void> {
  return login({ username, password });
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => {});
}

export async function signup(payload: { username: string; password: string; email?: string }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `signup failed: ${res.status}`);
  }

  return res.json().catch(() => ({}));
}
