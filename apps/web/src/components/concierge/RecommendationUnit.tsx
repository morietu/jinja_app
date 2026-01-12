"use client";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";

export default function RecommendationUnit({ rec, index }: { rec: ConciergeRecommendation; index: number }) {
  const safe: ConciergeRecommendation = {
    ...rec,
    name: (rec.name || rec.display_name || "（名称不明）").trim(),
  };

  return <ConciergeCard s={safe} index={index} />;
}
