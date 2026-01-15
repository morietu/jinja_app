// apps/web/src/features/concierge/types/unified.ts
import type { ConciergeThread, ConciergeRecommendation, ConciergeNeed } from "@/lib/api/concierge";

export type StopReason = "design" | "paywall" | null;

export type UnifiedConciergeResponse = {
  ok: boolean;
  stop_reason: StopReason;
  note?: string | null;
  reply?: string | null;
  remaining_free?: number | null;

  thread?: ConciergeThread | null;

  data: {
    recommendations: ConciergeRecommendation[];

    // ✅ 追加（optional）
    _need?: ConciergeNeed;
    _astro?: any;
  };
};
