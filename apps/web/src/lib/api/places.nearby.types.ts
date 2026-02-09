// apps/web/src/lib/api/places.nearby.types.ts

export type PlacesNearbyItem = {
  place_id: string;
  name: string;
  address: string; // formatted_address をここに正規化して返す
  lat: number;
  lng: number;
  shrine_id?: number | null; // 登録済みなら返す（任意）
  distance_m?: number | null; // 出せるなら出す（無理なら省略でOK）
  rating?: number | null;
  user_ratings_total?: number | null;
  icon?: string | null;
};

export type PlacesNearbyResult = {
  place_id: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  shrine_id?: number | null;
  distance_m?: number | null;
  rating?: number | null;
  user_ratings_total?: number | null;
  icon?: string | null;
};

export type PlacesNearbyResponse = { results: PlacesNearbyResult[] };
