"use client";

import ConciergeCard from "@/components/ConciergeCard";

type Recommendation = {
  name?: string;
  display_name?: string | null;
  address?: string | null;
  display_address?: string | null;

  id?: number | null;
  place_id?: string | null;

  reason?: string | null;
  photo_url?: string | null;

  lat?: number | null;
  lng?: number | null;
  location?: { lat?: number | null; lng?: number | null } | string | null;

  distance_m?: number | null;
  duration_min?: number | null;
};

export default function RecommendationUnit({ rec, index }: { rec: Recommendation; index: number }) {
  // ConciergeCard は name を参照するので保険
  const safe = { ...rec, name: (rec.display_name || rec.name || "（名称不明）") as string };
  return <ConciergeCard s={safe as any} index={index} />;
}
