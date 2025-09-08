export type ShrineId = string;

export type ShrineSummary = {
  id: ShrineId;
  name: string;
  address: string;
  popularity: number; // 0-100 スコア想定
  lat?: number;
  lng?: number;
};
