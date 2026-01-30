import type { Shrine } from "./types";
export type { Shrine } from "./types";

type FetchPopularOptions = {
  limit?: number;
  near?: string; // "lat,lng"
  radius_km?: number;
};

function toItems(data: any): Shrine[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export async function fetchPopular(opts: FetchPopularOptions) {
  const { limit, near, radius_km } = opts;

  const sp = new URLSearchParams();
  if (limit != null) sp.set("limit", String(limit));
  if (near) sp.set("near", near);
  if (radius_km != null) sp.set("radius_km", String(radius_km));

  const url = `/api/populars/${sp.toString() ? `?${sp.toString()}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch popular shrines");

  const data = await res.json();
  return {
    items: toItems(data),
    next: typeof data.next === "string" ? data.next : null, // ← BFF が /api/populars/?... に直してくれる前提
  };
}
