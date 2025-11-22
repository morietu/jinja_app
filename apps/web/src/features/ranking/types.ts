// apps/web/src/features/ranking/types.ts
export type ShrineRankingItem = {
  id: string;
  name: string;
  address?: string;
  rank: number;
  favorites?: number;
  views?: number;
};
