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
  limit?: number | null;
  thread_id?: string | null;

  thread?: ConciergeThread | null;

  data: {
    recommendations: ConciergeRecommendation[];
    _need?: ConciergeNeed;
    _astro?: any;
    _signals?: ConciergeSignals;
  };
};
