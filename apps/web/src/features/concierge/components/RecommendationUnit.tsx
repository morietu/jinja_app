// apps/web/src/features/concierge/components/RecommendationUnit.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import NeedChips from "@/features/concierge/components/NeedChips";
import ConciergeBreakdownBody, { pickReasonLabel } from "@/components/concierge/ConciergeBreakdownBody";
import { buildOneLiner } from "@/lib/concierge/pickAClause";

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
  index: number;
  needTags?: string[];
  tid?: string | null;
};

export default function RecommendationUnit({ rec, index, needTags = [], tid = null }: Props) {
  const safe: ConciergeRecommendation = {
    ...rec,
    name: (rec.name || rec.display_name || "（名称不明）").trim(),
  };

  const title = (safe.display_name || safe.name || "").trim() || "（名称不明）";
  const address = (safe.display_address || safe.address || "")?.toString().trim() || null;
  const description = (typeof safe.reason === "string" && safe.reason.trim()) || "候補として表示しています。";
  const imageUrl = (safe.photo_url || "")?.toString().trim() || null;

  const rawShrineId = (safe as any).shrine_id ?? null;
  const shrineId = rawShrineId != null ? Number(rawShrineId) : null;
  const placeId = (safe.place_id ?? null)?.toString() || null;


  const qs = new URLSearchParams();
  qs.set("ctx", "concierge");
  if (tid) qs.set("tid", tid);

  const detailHref =
    typeof shrineId === "number" && Number.isFinite(shrineId) && shrineId > 0
      ? `/shrines/${shrineId}?${qs.toString()}`
      : placeId
        ? `/shrines/from-place/${encodeURIComponent(placeId)}?${qs.toString()}`
        : undefined;

  const badges = [...(Array.isArray(safe.tags) ? safe.tags : []), ...(Array.isArray(needTags) ? needTags : [])].filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  );

  const breakdown = safe.breakdown ?? null;

  // 既存の「おすすめ理由：〜」バッジが欲しければここで追加
  const reasonLabel = pickReasonLabel(breakdown);
  const finalBadges = (
    [reasonLabel ? `おすすめ理由：${reasonLabel}` : null, ...badges].filter(Boolean) as string[]
  ).slice(0, 3);

  return (
    <div className="space-y-2">
      {index === 0 && needTags.length > 0 && <NeedChips tags={needTags} />}
      <ConciergeCard
        title={title}
        address={address}
        imageUrl={imageUrl}
        description={description}
        isPrimary={index === 0}
        badges={finalBadges}
        detailHref={detailHref}
        disclosureTitle="おすすめ理由"
        disclosureBody={
          <div className="space-y-3">
            {breakdown ? (
              <DisclosureSection title="おすすめ理由（内訳）">
                <ConciergeBreakdownBody breakdown={breakdown} />
              </DisclosureSection>
            ) : null}

            <DisclosureSection title="要点">
              <p className="text-sm text-slate-700 line-clamp-2">{buildOneLiner(breakdown)}</p>
            </DisclosureSection>
          </div>
        }
      />
    </div>
  );
}
