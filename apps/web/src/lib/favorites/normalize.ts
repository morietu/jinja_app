import type { Favorite } from "@/lib/api/favorites";

export type NormalizedFavorite = {
  pk: number; // favorite.id
  shrineId: number | null;
  placeId: string | null;
  title: string | null;
  address: string | null;
};

export function normalizeFavorite(f: Favorite): { shrineId: number | null; placeId: string | null } {
  const shrineId =
    (typeof f.shrine_id === "number" ? f.shrine_id : null) ??
    (typeof f.target_id === "number" && f.target_type === "shrine" ? f.target_id : null) ??
    (typeof f.shrine?.id === "number" ? f.shrine.id : null) ??
    (typeof f.target_id === "number" && !f.target_type ? f.target_id : null);

  const placeId =
    (typeof f.place_id === "string" && f.place_id.trim() ? f.place_id : null) ??
    (f.target_type === "place" ? String(f.target_id ?? "").trim() || null : null);

  return { shrineId, placeId };
}

export function favoriteMatchKey(f: Favorite, key: { shrineId?: number; placeId?: string }): boolean {
  const { shrineId, placeId } = key;
  const n = normalizeFavorite(f);

  if (typeof shrineId === "number") return n.shrineId === shrineId;
  if (placeId) return String(n.placeId ?? "") === String(placeId);
  return false;
}

export function favoriteKey(f: Favorite): string | null {
  const n = normalizeFavorite(f);
  if (n.shrineId != null) return `shrine:${n.shrineId}`;
  if (n.placeId) return `place:${n.placeId}`;
  return null;
}

export function dedupeFavorites(list: Favorite[]): Favorite[] {
  const seen = new Set<string>();
  const out: Favorite[] = [];

  for (const f of list) {
    const k = favoriteKey(f) ?? `pk:${f.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}
