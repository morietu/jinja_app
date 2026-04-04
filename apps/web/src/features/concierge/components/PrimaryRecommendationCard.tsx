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

  const description = [vm.why.primaryReason, vm.why.secondaryReason, vm.why.summary].filter(Boolean).join(" ");

  const chips = [...(vm.hero.topReasonLabel ? [vm.hero.topReasonLabel] : [])];

  return (
    <ConciergeCard
      title={(rec.display_name || rec.name || "").trim() || "（名称不明）"}
      description={description}
      isPrimary
      badges={chips}
    />
  );
}
