// apps/web/src/lib/api/popular.ts
import type { Shrine } from "./types";

export type { Shrine } from "./types";

type FetchPopularOptions = {
  limit?: number;
  near?: string; // "lat,lng"
  radius_km?: number; // backend 側と同じ param 名にしておく
  urlOverride?: string | null;
};

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";
const POPULARS_API_BASE = `${BACKEND_ORIGIN}/api/populars/`;

export async function fetchPopular(opts: FetchPopularOptions) {
  const { limit, near, radius_km, urlOverride } = opts;

  // next ページ用に、backend から返ってきた next のフル URL をそのまま叩くパス
  if (urlOverride) {
    const res = await fetch(urlOverride, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("failed to fetch popular shrines");
    }
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

  // ✅ 通常パス: Django(8000) の /api/populars/ を直接叩く
  const searchParams = new URLSearchParams();
  if (limit != null) searchParams.set("limit", String(limit));
  if (near) searchParams.set("near", near);
  if (radius_km != null) searchParams.set("radius_km", String(radius_km));

  const query = searchParams.toString();
  const url = query.length > 0 ? `${POPULARS_API_BASE}?${query}` : POPULARS_API_BASE;

  console.log("fetchPopular URL =", url);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch popular shrines");
  }

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
