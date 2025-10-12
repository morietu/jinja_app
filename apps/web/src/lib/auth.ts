// apps/web/src/lib/auth.ts
import { login as loginApi } from "@/lib/api/auth";

export async function login({ username, password }: { username: string; password: string }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return res.ok;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login";
}

/** 旧API互換（移行中だけ残す。完了したら削除OK） */
export async function loginAndFetchMe(username: string, password: string) {
  const ok = await login({ username, password });
  if (!ok) throw new Error("Login failed");
  // Cookie方式なので Authorization ヘッダは不要
  const meRes = await fetch("/api/users/me/", { credentials: "include" });
  if (!meRes.ok) throw new Error("GET /api/users/me failed");
  return meRes.json();
}
