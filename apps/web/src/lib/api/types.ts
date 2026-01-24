// src/lib/types.ts
export type GoriyakuTag = {
  id: number;
  name: string;
  category?: string | null;
};

export type ShrineBase = {
  id: number;
  name_jp: string;
  name_romaji?: string | null;
  address: string;
  lat?: number | null;
  lng?: number | null;
  main_photo?: string | null;
  main_photo_url?: string | null;
  photo_urls?: string[] | null;
  latitude: number;
  longitude: number;
  goriyaku?: string;
  sajin?: string;
  description?: string | null;
  goriyaku_tags: GoriyakuTag[];
};

export type Shrine = ShrineBase;

export type RankingItem = ShrineBase & {
  score: number;
  visit_count: number;
  favorite_count: number;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
