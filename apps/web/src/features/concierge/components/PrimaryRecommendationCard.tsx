// apps/web/src/features/concierge/components/PrimaryRecommendationCard.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import { buildOneLiner } from "@/lib/concierge/pickAClause";

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
 
  const breakdown = (rec as any)?.breakdown ?? null;

  const oneLiner = breakdown && typeof breakdown === "object" ? buildOneLiner(breakdown) : null;

  const description =
    (typeof oneLiner === "string" && oneLiner.trim()) ||
    (typeof rec.reason === "string" && rec.reason.trim()) ||
    "まずは代表的な候補から表示しています。";



  return (
    <ConciergeCard
      title={(rec.display_name || rec.name || "").trim() || "（名称不明）"}
      description={description}
      isPrimary
      badges={Array.isArray(needTags) ? needTags.filter((t) => typeof t === "string" && t.trim()) : []}
    />
  );
}
