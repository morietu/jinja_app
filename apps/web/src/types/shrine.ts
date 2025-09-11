// apps/web/src/types/shrine.ts
export type Shrine = {
  id: number;
  name_jp: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_favorite?: boolean;
  goriyaku?: string | null;
  goriyaku_tags?: { id: number; name: string }[];
  // 人気APIが返す場合の追加（任意）
  views_30d?: number | null;
  favorites_30d?: number | null;
  popular_score?: number | null;
};

export type ShrineSummary = {
  id: number;                  // 一覧用は number に寄せる（mock は後述で吸収）
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  popularity?: number | null;  // popular_score をここにマップ
  is_favorite?: boolean;
  goriyaku_tags?: { id: number; name: string }[];
};
