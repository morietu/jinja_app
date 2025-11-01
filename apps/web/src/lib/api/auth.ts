// apps/web/src/lib/api/auth.ts
export type LoginInput = { username: string; password: string };

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

export async function logout(): Promise<void> {
  // 200 以外でも致命的ではないので握りつぶしでOK
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => {});
}
