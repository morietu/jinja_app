// apps/web/src/lib/api/inflight.ts
const inflight = new Map<string, Promise<any>>();

export function fetchOnce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;

  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ✅ 追加：必要なら手動で無効化できる
export function invalidateOnce(key: string) {
  inflight.delete(key);
}
