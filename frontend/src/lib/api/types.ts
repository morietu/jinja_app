// src/lib/types.ts
export type GoriyakuTag = {
  id: number;
  name: string;
};

export type ShrineBase = {
  id: number;
  name_jp: string;
  address: string;
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
