// apps/web/src/lib/api/users.ts
export type UserMe = {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile?: { nickname?: string; is_public?: boolean; website?: string } | null;
};

export async function getCurrentUser(
  signal?: AbortSignal
): Promise<UserMe | null> {
  const res = await fetch("/api/users/me/", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `getCurrentUser failed: ${res.status}`);
  }
  return (await res.json()) as UserMe;
}

/** 必要なら PATCH も用意（MyPage が import しているため） */
export async function updateUser(patch: Partial<UserMe>): Promise<UserMe> {
  const res = await fetch("/api/users/me/", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `updateUser failed: ${res.status}`);
  }
  return (await res.json()) as UserMe;
}
