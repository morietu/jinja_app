// apps/web/lib/api/http.ts
export async function get<T>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const qs = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = `${path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
