// apps/web/src/lib/server/backend.ts
export const BACKEND =
  process.env.BACKEND_ORIGIN ||
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
  "http://127.0.0.1:8000";

export async function djFetch(path: string, init?: RequestInit) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      ...init,
      signal: ac.signal,
      cache: "no-store",
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}
