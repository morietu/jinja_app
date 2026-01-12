// apps/mobaile/ types/shrine.ts

export type ShrineId = string;

export type ShrineSummary = {
  id: ShrineId;
  name: string;
  address: string;
  popularity: number; // 0-100 スコア想定
  lat?: number;
  lng?: number;

  // ✅ 追加：カード表示で使う
  rating?: number; // 例: 4.6
  photo_url?: string; // 画像URL
};
