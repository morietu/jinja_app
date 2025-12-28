// features/concierge/types/unified.ts
export type StopReason = "design" | "paywall" | null;

export type UnifiedConciergeResponse = {
  ok: boolean;
  stop_reason: StopReason;
  note?: string | null;
  reply?: string | null;
  remaining_free?: number | null;
  data: {
    recommendations: Array<{
      name: string;
      reason?: string;
    }>;
  };
};
