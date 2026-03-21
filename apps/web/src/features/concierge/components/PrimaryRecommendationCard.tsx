// apps/web/src/features/concierge/components/PrimaryRecommendationCard.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import { buildRecommendationReasonViewModel } from "@/lib/concierge/buildRecommendationReasonViewModel";

type Props = {
  rec: ConciergeRecommendation;
  primaryIndex: number;
  needTags?: string[];
  tid?: string | null;
  mode?: "need" | "compat" | string | null;
  birthdate?: string | null;
};

export default function PrimaryRecommendationCard({
  rec,
  primaryIndex,
  needTags = [],
  tid: _tid,
  mode,
  birthdate,
}: Props) {
  const vm = buildRecommendationReasonViewModel({
    rec,
    index: primaryIndex,
    mode,
    birthdate,
    needTags,
  });

  const description = [vm.primaryReason, vm.secondaryReason, vm.summary]
    .filter((x): x is string => typeof x === "string" && !!x.trim())
    .join(" / ");

  const badges = [
    ...(vm.topReasonLabel ? [vm.topReasonLabel] : []),
    ...(Array.isArray(needTags) ? needTags : []).filter((t) => typeof t === "string" && t.trim()).slice(0, 2),
  ];

  return (
    <ConciergeCard
      title={(rec.display_name || rec.name || "").trim() || "（名称不明）"}
      description={description}
      isPrimary
      badges={badges}
    />
  );
}
