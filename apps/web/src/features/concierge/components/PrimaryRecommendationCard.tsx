// apps/web/src/features/concierge/components/PrimaryRecommendationCard.tsx
"use client";

import * as React from "react";
import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";

type Props = {
  rec: ConciergeRecommendation;
  primaryIndex: number; // 互換維持
  needTags?: string[];
  tid?: string | null;
};

export default function PrimaryRecommendationCard({
  rec,
  primaryIndex: _primaryIndex,
  needTags = [],
  tid: _tid,
}: Props) {
  return (
    <ConciergeCard
      title={(rec.display_name || rec.name || "").trim() || "（名称不明）"}
      description={(typeof rec.reason === "string" && rec.reason.trim()) || "まずは代表的な候補から表示しています。"}
      isPrimary
      badges={Array.isArray(needTags) ? needTags.filter((t) => typeof t === "string" && t.trim()) : []}
    />
  );
}
