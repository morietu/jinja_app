// apps/web/src/components/shrines/ShrineConciergeCard.tsx
"use client";

import * as React from "react";
import ConciergeCard from "@/components/ConciergeCard";
import { useFavorite } from "@/hooks/useFavorite";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";

export type ShrineConciergeCardProps = {
  shrineId: number;
  title: string;
  address?: string | null;
  description?: string | null;
  imageUrl?: string | null;

  explanationSummary?: string | null;
  explanationPrimaryReason?: string | null;

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

export default function ShrineConciergeCard({
  shrineId,
  title,
  address,
  imageUrl,
  explanationSummary,
  explanationPrimaryReason,

  hideDescription = false,

  hideBadges = false,
  hideLeftMark = false,
  hideAddress = false,

  showFavorite = true,
  initialFav = false,
  readOnly = false,
  detailHref,
  breakdown: _breakdown,
  badgesOverride,
  hideDetailLink = false,

  hideDisclosure = true,
  variant = "list",
}: ShrineConciergeCardProps) {
  const isHero = variant === "hero";

  const effHideBadges = isHero ? true : hideBadges;
  const effHideLeftMark = isHero ? true : hideLeftMark;
  const effHideAddress = isHero ? true : hideAddress;
  const effShowFavorite = isHero ? false : showFavorite;
  const effHideDetailLink = isHero ? true : hideDetailLink;

  const { fav, busy, toggle } = useFavorite({ shrineId, initial: initialFav });

  const addr = effHideAddress ? "" : (address ?? "").trim() || "住所情報は準備中です。";
  const safeDetailHref = detailHref ?? (Number.isFinite(shrineId) ? buildShrineHref(shrineId) : undefined);
  const cardDetailHref = effHideDetailLink ? undefined : safeDetailHref;

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

  const mainSummary = explanationSummary?.trim() || "条件に合う候補から選びました。";

  const supportingReason = hideDescription ? "" : explanationPrimaryReason?.trim() || "";

  const badges =
    badgesOverride?.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 3) ?? [];

  return (
    <ConciergeCard
      title={title}
      address={addr || undefined}
      imageUrl={imageUrl}
      subtitle={mainSummary}
      description={supportingReason}
      hideBadges={effHideBadges}
      hideLeftMark={effHideLeftMark}
      isPrimary={variant !== "detail"}
      badges={badges}
      detailHref={cardDetailHref}
      headerRight={favButton}
      disclosureTitle={undefined}
      disclosureBody={undefined}
    />
  );
}
