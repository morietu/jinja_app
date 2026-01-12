// apps/mobile/app/shrines/storage.ts
import { getRecents } from "../../lib/storage";
import { SHRINES } from "../../data/shrines";

type RecentItem = {
  id: number | string;
  name: string;
  address?: string;
  rating?: number;
  photo_url?: string;
  popularity?: number;
};

export async function getRecentViewed(limit = 10): Promise<RecentItem[]> {
  const ids = await getRecents();
  const picked = ids
    .map((id) => SHRINES.find((s: any) => String(s.id) === String(id)))
    .filter(Boolean)
    .slice(0, limit) as any[];

  return picked.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.prefecture ?? s.address ?? "",
    rating: s.rating,
    photo_url: s.imageUrl ?? s.photo_url ?? undefined,
    popularity: s.popularity,
  }));
}
