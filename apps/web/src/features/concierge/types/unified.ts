// apps/web/src/features/concierge/types/unified.ts
import type { ConciergeThread, ConciergeRecommendation, ConciergeNeed } from "@/lib/api/concierge";

export type StopReason = "design" | "paywall" | null;

export type ConciergeModeSignal = {
  flow: "A" | "B";
  weights: { element: number; need: number; popular: number };
  astro_bonus_enabled: boolean;
  description?: string;
  ui_label_ja?: string;
  ui_note_ja?: string;
};

export type ConciergeSignals = {
  mode?: ConciergeModeSignal;
  astro?: unknown;
  need_tags?: unknown;
  user_filters?: unknown;
};

export type UnifiedConciergeResponse = {
  ok: boolean;
  stop_reason: StopReason;
  note?: string | null;
  reply?: string | null;
  remaining_free?: number | null;

  thread?: ConciergeThread | null;

  data: {
    recommendations: ConciergeRecommendation[];

    // ✅ 既存
    _need?: ConciergeNeed;
    _astro?: any;

    // ✅ 追加（optionalで互換維持）
    _signals?: ConciergeSignals;

    // （あれば）_explain も後で足せるけど、今は要らない
    // _explain?: unknown;
  };
};
