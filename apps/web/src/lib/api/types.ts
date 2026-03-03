// src/lib/types.ts

export type Goshuin = {
  id: number;
  shrine?: number | null;
  shrine_name?: string | null;
  title?: string | null;
  is_public: boolean;
  likes?: number | null;
  created_at?: string | null;
  image_url?: string | null;
};

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

  latitude: number | null;
  longitude: number | null;

  // うっかり参照をコンパイルで殺す
  lat?: never;
  lng?: never;

  main_photo?: string | null;
  main_photo_url?: string | null;
  photo_urls?: string[] | null;
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
