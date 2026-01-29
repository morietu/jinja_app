// apps/web/src/components/shrine/ShrineCard.tsx
"use client";

import * as React from "react";
import ConciergeCard from "@/components/ConciergeCard";
import { useFavorite } from "@/hooks/useFavorite";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildOneLiner } from "@/lib/concierge/pickAClause";
import ConciergeBreakdownBody, { pickReasonLabel } from "@/components/concierge/ConciergeBreakdownBody";

type Props = {
  shrineId: number;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;

  hideDescription?: boolean;

  subtitle?: string;
  hideBadges?: boolean;
  hideLeftMark?: boolean;
  hideAddress?: boolean;

  showFavorite?: boolean;
  readOnly?: boolean;
  initialFav?: boolean;
  detailHref?: string;
  breakdown?: ConciergeBreakdown | null;
  badgesOverride?: string[];
  hideDetailLink?: boolean;

  hideDisclosure?: boolean;
  variant?: "list" | "detail" | "hero";
};

function DisclosureSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  );
}

export default function ShrineCard({
  shrineId,
  title,
  address,
  description,
  imageUrl,

  hideDescription = false,

  subtitle,
  hideBadges = false,
  hideLeftMark = false,
  hideAddress = false,

  showFavorite = true,
  initialFav = false,
  readOnly = false,
  detailHref,
  breakdown,
  badgesOverride,
  hideDetailLink = false,

  hideDisclosure = false,
  variant = "list",
}: Props) {
  const isHero = variant === "hero";

  // ✅ Hero強制（散らかり防止）
  const effHideDescription = isHero ? true : hideDescription;
  const effHideBadges = isHero ? true : hideBadges;
  const effHideLeftMark = isHero ? true : hideLeftMark;
  const effHideAddress = isHero ? true : hideAddress;
  const effShowFavorite = isHero ? false : showFavorite;
  const effHideDetailLink = isHero ? true : hideDetailLink;
  const effHideDisclosure = isHero ? true : hideDisclosure;

  const effBreakdown = isHero ? null : breakdown;
  const effBadgesOverride = isHero ? [] : badgesOverride;

  // hook（条件分岐不可なので常に呼ぶ）
  const { fav, busy, toggle } = useFavorite({ shrineId, initial: initialFav });

  // description/address/detail
  const safeDescription = effHideDescription ? "" : (description ?? "");
  const addr = effHideAddress ? "" : (address ?? "").trim() || "住所情報は準備中です。";
  const safeDetailHref = detailHref ?? (Number.isFinite(shrineId) ? `/shrines/${shrineId}` : undefined);
  const cardDetailHref = effHideDetailLink ? undefined : safeDetailHref;

  // favorite button
  const favButton = !effShowFavorite ? null : (
    <button
      onClick={toggle}
      disabled={busy || readOnly}
      className="text-sm font-semibold"
      aria-pressed={fav}
      aria-label={fav ? "お気に入り解除" : "お気に入りに追加"}
      title={fav ? "お気に入り解除" : "お気に入りに追加"}
    >
      {fav ? "★" : "☆"}
    </button>
  );

  // badges
  const reasonLabel = pickReasonLabel(effBreakdown);
  const defaultBadges = ["正式登録", reasonLabel ? `おすすめ理由：${reasonLabel}` : null]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, 2);

  const badges =
    effBadgesOverride?.filter((v): v is string => typeof v === "string" && v.trim().length > 0) ?? defaultBadges;

  // disclosure（hero は eff で潰れる）
  const shouldHideDisclosure = effHideDisclosure || variant === "detail";
  const disclosureTitle = shouldHideDisclosure ? undefined : "おすすめ理由を見る";
  const disclosureBody = shouldHideDisclosure ? undefined : (
    <div className="space-y-3">
      {effBreakdown ? (
        <DisclosureSection title="おすすめ理由（内訳）">
          <ConciergeBreakdownBody breakdown={effBreakdown} />
        </DisclosureSection>
      ) : null}

      <DisclosureSection title="要点">
        <p className="text-sm text-slate-700 line-clamp-2">
          {effBreakdown ? buildOneLiner(effBreakdown) : "条件に合う候補から選びました。"}
        </p>
      </DisclosureSection>
    </div>
  );

  return (
    <ConciergeCard
      title={title}
      address={addr || undefined}
      imageUrl={imageUrl}
      description={safeDescription}
      subtitle={subtitle}
      hideBadges={effHideBadges}
      hideLeftMark={effHideLeftMark}
      isPrimary
      badges={badges}
      detailHref={cardDetailHref}
      headerRight={favButton}
      disclosureTitle={disclosureTitle}
      disclosureBody={disclosureBody}
    />
  );
}
