// apps/web/src/features/concierge/types/unified.ts
import type { ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";

export type StopReason = "design" | "paywall" | null;

export type UnifiedConciergeResponse = {
  ok: boolean;
  stop_reason: StopReason;
  note?: string | null;
  reply?: string | null;
  // （任意）バックが返すなら拾う：表示や判定を Unified に寄せやすくなる
  remaining_free?: number | null;

    
  thread?: ConciergeThread | null;

  data: {
    // ✅ カード表示に必要な型へ統一（ConciergeLayout がそのまま使える）
    recommendations: ConciergeRecommendation[];
  };
};
