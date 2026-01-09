// apps/web/src/features/concierge/embedHistoryTypes.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";

export type ConciergeEmbedHistoryItem = {
  id: string; // crypto/randomでもOK
  at: string; // ISO
  query: string; // ユーザー入力（短くしてもOK）
  primary: ConciergeRecommendation; // まずは1件で十分
  alternatives?: ConciergeRecommendation[]; // 後で
};
