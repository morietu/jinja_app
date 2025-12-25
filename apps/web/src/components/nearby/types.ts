// apps/web/src/components/nearby/types.ts

export type NearbyItemBase = {
  title: string; // 表示名
  subtitle?: string; // 住所など
  distance_m?: number | null;
  lat?: number | null;
  lng?: number | null;
};

// Google Places 由来（resolve に必須）
export type NearbyPlaceItem = NearbyItemBase & {
  kind: "place";
  place_id: string;
  rating?: number | null;
  user_ratings_total?: number | null;
  icon?: string | null;
};

// DB Shrine 由来（/shrines/[id] に直リンクできる）
export type NearbyShrineItem = NearbyItemBase & {
  kind: "shrine";
  id: number;
  name_jp?: string | null;
};

export type NearbyItem = NearbyPlaceItem | NearbyShrineItem;

export function nearbyItemKey(x: NearbyItem): string {
  return x.kind === "place" ? `place:${x.place_id}` : `shrine:${x.id}`;
}
