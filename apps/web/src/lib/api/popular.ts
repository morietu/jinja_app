// apps/web/src/lib/api/popular.ts
import type { Shrine } from "./types";

export type { Shrine } from "./types";

type FetchPopularOptions = {
  limit?: number;
  near?: string; // "lat,lng"
  radius_km?: number;
  urlOverride?: string | null;
};

// ✅ BFF 経由に統一（直叩き禁止）
const POPULARS_API_BASE = "/api/populars/";

/**
 * backend の next がフルURLで返ってきても、BFF 経由に正規化して叩く。
 * - "/api/..." はそのまま
 * - "http(s)://.../api/..." は "/api/..." に落とす
 */
function normalizeNextUrl(u: string): string {
  if (u.startsWith("/api/")) return u;

  try {
    const parsed = new URL(u);
    const idx = parsed.pathname.indexOf("/api/");
    if (idx >= 0) {
      const pathAndQuery = parsed.pathname.slice(idx) + (parsed.search ?? "");
      return pathAndQuery; // "/api/..."
    }
  } catch {
    // ignore
  }
  return u; // 最後の保険（ただし基本ここには来ない想定）
}

export async function fetchPopular(opts: FetchPopularOptions) {
  const { limit, near, radius_km, urlOverride } = opts;

  // next ページ用: 返ってきた next を正規化して BFF 経由で叩く
  if (urlOverride) {
    const url = normalizeNextUrl(urlOverride);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("failed to fetch popular shrines");
    const data = await res.json();
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
        ? data.results
        : Array.isArray(data.items)
          ? data.items
          : [];
    const next = typeof data.next === "string" ? data.next : null;
    return { items: items as Shrine[], next };
  }

  const sp = new URLSearchParams();
  if (limit != null) sp.set("limit", String(limit));
  if (near) sp.set("near", near);
  if (radius_km != null) sp.set("radius_km", String(radius_km));

  const url = sp.toString() ? `${POPULARS_API_BASE}?${sp.toString()}` : POPULARS_API_BASE;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch popular shrines");

  const data = await res.json();
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.items)
        ? data.items
        : [];
  const next = typeof data.next === "string" ? data.next : null;

  return { items: items as Shrine[], next };
}
