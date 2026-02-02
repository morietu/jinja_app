"use client";

import { useRouter } from "next/navigation";
import { resolvePlace } from "@/lib/api/places";

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
  isPrimary?: boolean;
  showNeedChips?: boolean;
  needTags?: string[];
  tid?: string | null;
};

export default function RecommendationUnit({
  rec,
  isPrimary = false,
  showNeedChips = false,
  needTags = [],
  tid = null,
}: Props) {
  const router = useRouter();

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
  const placeId = (safe.place_id ?? null)?.toString().trim() || null;

  const qs = new URLSearchParams();
  qs.set("ctx", "concierge");
  if (tid) qs.set("tid", tid);

  const directHref = shrineId ? `/shrines/${shrineId}?${qs.toString()}` : null;

  const badges = [...(Array.isArray(safe.tags) ? safe.tags : []), ...(Array.isArray(needTags) ? needTags : [])].filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  );

  const breakdown = safe.breakdown ?? null;
  const reasonLabel = pickReasonLabel(breakdown);

  const finalBadges = (
    [reasonLabel ? `おすすめ理由：${reasonLabel}` : null, ...badges].filter(Boolean) as string[]
  ).slice(0, 3);

  const onGoDetail = async () => {
    // shrineId があれば即遷移
    if (shrineId && directHref) {
      router.push(directHref);
      return;
    }
    // placeId しかないなら、ここで解決してから詳細へ
    if (placeId) {
      const r = await resolvePlace(placeId);
      router.push(`/shrines/${r.shrine_id}?${qs.toString()}`);
    }
  };

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
        detailHref={directHref ?? undefined}
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
