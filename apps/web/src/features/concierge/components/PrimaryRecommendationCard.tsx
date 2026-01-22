// apps/web/src/features/concierge/components/PrimaryRecommendationCard.tsx
"use client";

import * as React from "react";
import ConciergeCard from "@/components/ConciergeCard";
import ShrineCard from "@/components/shrine/ShrineCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import { pickReasonLabel } from "@/components/concierge/ConciergeBreakdownBody";

type Props = {
  rec: ConciergeRecommendation;
  primaryIndex: number; // 互換維持
  needTags?: string[];
  tid?: string | null;
};

export default function PrimaryRecommendationCard({ rec, primaryIndex: _primaryIndex, needTags = [], tid }: Props) {
  

  // shrine_id
  const rawShrineId = (rec as any).shrine_id ?? (rec as any).id ?? null;
  const shrineId = rawShrineId != null ? Number(rawShrineId) : null;

  // place_id
  const rawPlaceId = (rec as any).place_id ?? (rec as any).placeId ?? (rec as any).google_place_id ?? null;
  const placeId = rawPlaceId != null ? String(rawPlaceId) : null;

  const title = (rec.display_name || rec.name || "").trim() || "（名称不明）";
  const address = ((rec as any).display_address ?? (rec as any).address ?? null)?.toString().trim() || null;

  const imageUrl = ((rec as any).photo_url ?? null)?.toString().trim() || null;
  const description = (typeof rec.reason === "string" && rec.reason.trim()) || "まずは代表的な候補から表示しています。";

  const badges = Array.isArray(needTags) ? needTags.filter((t) => typeof t === "string" && t.trim()) : [];

  const heroBadges = ["今のあなたに最適", pickReasonLabel(rec.breakdown)].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );

  // ✅ 正式な神社
  if (typeof shrineId === "number" && Number.isFinite(shrineId) && shrineId > 0) {
    const params = new URLSearchParams();
    params.set("ctx", "concierge");
    if (tid) params.set("tid", tid);

    const detailHref = `/shrines/${shrineId}?${params.toString()}`;

    return (
      <ShrineCard
        shrineId={shrineId}
        title={title}
        address={address}
        description={description}
        imageUrl={imageUrl}
        initialFav={false}
        readOnly={false}
        breakdown={rec.breakdown ?? null}
        detailHref={detailHref}
        badgesOverride={heroBadges}
      />
    );
  }

  

  // ✅ 仮候補（place）
  let detailHref: string | undefined;
  if (placeId) {
    const params = new URLSearchParams();
    params.set("ctx", "concierge");
    if (tid) params.set("tid", tid);
    detailHref = `/shrines/from-place/${encodeURIComponent(placeId)}?${params.toString()}`;
  }

  return (
    <ConciergeCard
      title={title}
      address={address}
      imageUrl={imageUrl}
      description={description}
      isPrimary
      badges={badges}
      detailHref={detailHref}
    />
  );
}
