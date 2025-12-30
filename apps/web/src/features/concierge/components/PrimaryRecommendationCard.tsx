"use client";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";

type Props = {
  rec: ConciergeRecommendation;
  primaryIndex: number;
};

export default function PrimaryRecommendationCard({ rec, primaryIndex }: Props) {
  return (
    <div className="mt-3">
      <ConciergeCard
        key={(rec as any).shrine_id ?? rec.id ?? rec.place_id ?? primaryIndex}
        s={{
          ...rec,
          id: (rec as any).shrine_id ?? rec.id ?? null,
          distance_m: typeof rec.distance_m === "number" ? rec.distance_m : null,
          duration_min: typeof rec.duration_min === "number" ? rec.duration_min : null,
        }}
        index={0}
        showMapButton
      />
    </div>
  );
}
