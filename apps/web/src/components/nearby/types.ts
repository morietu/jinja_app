// apps/web/src/components/nearby/types.ts

export type NearbyItemBase = {
  title: string; // 表示名
  subtitle?: string; // 住所など
  distance_m?: number | null;
  lat?: number | null;
  lng?: number | null;
  // 既に NearbyListItem が duration_min を見てるなら残す
  duration_min?: number | null;
};

// Google Places 由来（resolve に必須）
export type NearbyPlaceItem = NearbyItemBase & {
  kind: "place";
  place_id: string;
  rating?: number | null;
  user_ratings_total?: number | null;
  icon?: string | null;
};

// DB 由来（/shrines/[id] に直リンクできる）
export type NearbyTempleItem = NearbyItemBase & {
  kind: "temple";
  temple_id: string;
};

export type NearbyItem = NearbyPlaceItem | NearbyTempleItem;

export function nearbyItemKey(x: NearbyItem): string {
  return x.kind === "place" ? `place:${x.place_id}` : `temple:${x.temple_id}`;
}
