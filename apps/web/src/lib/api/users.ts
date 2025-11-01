// apps/web/src/lib/api/users.ts
export type UserMe = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: any;
};

export async function getCurrentUser(signal?: AbortSignal): Promise<UserMe | null> {
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
