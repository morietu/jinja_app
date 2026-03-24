// NOTE: legacy UI only (do not use in ConciergeSectionsRenderer)
"use client";

import type React from "react";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import NeedChips from "@/features/concierge/components/NeedChips";
import ConciergeBreakdownBody from "@/components/concierge/ConciergeBreakdownBody";
import { pickReasonLabel } from "@/lib/concierge/breakdownText";
import { buildOneLiner } from "@/lib/concierge/pickAClause";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { buildShrineResolveHref } from "@/lib/nav/buildShrineResolveHref";

function DisclosureSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  );
}

type Props = {
  rec: ConciergeRecommendation;
  isPrimary?: boolean;
  showNeedChips?: boolean;
  needTags?: string[];
  tid?: string | number | null;
};

export default function RecommendationUnit({
  rec,
  isPrimary = false,
  showNeedChips = false,
  needTags = [],
  tid = null,
}: Props) {
  const safe: ConciergeRecommendation = {
    ...rec,
    name: (rec.name || rec.display_name || "（名称不明）").trim(),
  };

  const title = (safe.display_name || safe.name || "").trim() || "（名称不明）";
  const address = (safe.display_address || safe.address || "")?.toString().trim() || null;
  const description = (typeof safe.reason === "string" && safe.reason.trim()) || "候補として表示しています。";
  const imageUrl = (safe.photo_url || "")?.toString().trim() || null;

  const rawShrineId = (safe as any).shrine_id ?? (safe as any).shrine?.id ?? null;
  const shrineId = rawShrineId != null ? Number(rawShrineId) : null;
  const hasShrineId = Number.isFinite(shrineId) && (shrineId as number) > 0;

  const rawPlaceId = (safe as any).place_id ?? (safe as any).placeId ?? null;
  const placeId = rawPlaceId != null ? String(rawPlaceId).trim() : null;

  const tidStr = tid != null ? String(tid).trim() : "";
  const tidQ: string | null = tidStr.length ? tidStr : null;

  const href = hasShrineId
    ? buildShrineHref(shrineId as number, { ctx: "concierge", tid: tidQ })
    : placeId
      ? buildShrineResolveHref(placeId, { ctx: "concierge", tid: tidQ })
      : undefined;

  const badges = [
    ...(Array.isArray((safe as any).tags) ? (safe as any).tags : []),
    ...(Array.isArray(needTags) ? needTags : []),
  ].filter((t): t is string => typeof t === "string" && t.trim().length > 0);

  const breakdown = (safe as any).breakdown ?? null;
  const reasonLabel = pickReasonLabel(breakdown);

  const finalBadges = (
    [reasonLabel ? `おすすめ理由：${reasonLabel}` : null, ...badges].filter(Boolean) as string[]
  ).slice(0, 3);

  return (
    <div className="space-y-2">
      {showNeedChips && needTags.length > 0 && <NeedChips tags={needTags} />}

      <ConciergeCard
        title={title}
        address={address}
        imageUrl={imageUrl}
        description={description}
        isPrimary={isPrimary}
        badges={finalBadges}
        detailHref={href}
        disclosureTitle="おすすめ理由"
        disclosureBody={
          <div className="space-y-3">
            {breakdown ? (
              <DisclosureSection title="おすすめ理由（内訳）">
                <ConciergeBreakdownBody breakdown={breakdown} />
              </DisclosureSection>
            ) : null}

            <DisclosureSection title="要点">
              <p className="text-sm text-slate-700 line-clamp-2">
                {breakdown ? buildOneLiner(breakdown) : "条件に合う候補から選びました。"}
              </p>
            </DisclosureSection>
          </div>
        }
      />
    </div>
  );
}
