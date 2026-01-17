// apps/web/src/features/concierge/components/PrimaryRecommendationCard.tsx
"use client";

import * as React from "react";
import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";

type Props = {
  rec: ConciergeRecommendation;
  primaryIndex: number;
  needTags?: string[];
};

export default function PrimaryRecommendationCard({ rec, primaryIndex, needTags = [] }: Props) {
  // ConciergeCard が参照する id / place_id の揺れをここで正規化
  const rawPlaceId = (rec as any).place_id ?? (rec as any).placeId ?? (rec as any).google_place_id ?? null;
  const placeId = rawPlaceId != null ? String(rawPlaceId) : null;

  const rawShrineId = (rec as any).shrine_id ?? (rec as any).id ?? null;
  const shrineId = typeof rawShrineId === "number" ? rawShrineId : rawShrineId != null ? Number(rawShrineId) : null;

  return (
    <div>
      <ConciergeCard
        key={shrineId ?? placeId ?? primaryIndex}
        s={{
          ...(rec as any),
          id: shrineId,
          place_id: placeId,
          distance_m: typeof (rec as any).distance_m === "number" ? (rec as any).distance_m : null,
          duration_min: typeof (rec as any).duration_min === "number" ? (rec as any).duration_min : null,
          breakdown: {
            ...(rec as any).breakdown,
            matched_need_tags: Array.isArray((rec as any)?.breakdown?.matched_need_tags)
              ? (rec as any).breakdown.matched_need_tags
              : needTags,
          },
        }}
        index={0}
      />
    </div>
  );
}
