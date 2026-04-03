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

  suppressHeroCopy?: boolean;
};

function buildHeroClaimFromTags(tags?: string[] | null): string {
  const set = new Set((tags ?? []).filter(Boolean));

  if (set.has("mental") && set.has("rest")) {
    return "今の疲れを整えたいなら、この神社が最適です。";
  }

  if (set.has("career") && set.has("mental") && set.has("courage")) {
    return "不安を整えながら次の一歩を踏み出すなら、この神社が最適です。";
  }

  if (set.has("career") && set.has("courage")) {
    return "仕事や転機で前に進みたいなら、この神社が最適です。";
  }

  if (set.has("money") && set.has("courage")) {
    return "金運と行動の流れを変えたいなら、この神社が最適です。";
  }

  if (set.has("love")) {
    return "良縁を前向きに育てたいなら、この神社が最適です。";
  }

  if (set.has("study")) {
    return "学業や合格に集中したいなら、この神社が最適です。";
  }

  if (set.has("mental")) {
    return "心の不安を整えたいなら、この神社が最適です。";
  }

  if (set.has("rest")) {
    return "落ち着いて心身を休めたいなら、この神社が最適です。";
  }

  return "今の相談に最も合う参拝先です。";
}

function buildHeroReason(reason?: string | null): string {
  const s = (reason ?? "").trim();
  if (!s) return "→ 今の状態と強く一致しています。";

  if (s.includes("不安") && s.includes("前")) {
    return "→ 不安を整えつつ前進したい状態と強く一致しています。";
  }

  if (s.includes("疲れ") || s.includes("休息") || s.includes("落ち着")) {
    return "→ 今の不安を静かに整えたいなら、この神社が最適です。";
  }

  if (s.includes("金運") && (s.includes("行動") || s.includes("前向き"))) {
    return "→ 金運と行動の両方を求める状態と強く一致しています。";
  }

  if (s.includes("恋愛") || s.includes("良縁")) {
    return "→ 良縁を前向きに進めたい状態と強く一致しています。";
  }

  if (s.includes("学業") || s.includes("資格") || s.includes("試験")) {
    return "→ 学業や合格に集中したい状態と強く一致しています。";
  }

  return "→ 今の状態と強く一致しています。";
}


function buildListDescriptionFromReason(reason?: string | null): string {
  const s = (reason ?? "").trim();

  if (!s) return "今の悩みに合わせて選びやすい神社です。";

  if (s.includes("流れを切り替え")) {
    return "流れを切り替えたい時に選びやすい神社です。";
  }

  if (s.includes("巡りを整え")) {
    return "巡りを整えたい時に選びやすい神社です。";
  }

  if (s.includes("気持ちを切り替え")) {
    return "気持ちを切り替えたい時に選びやすい神社です。";
  }

  if (s.includes("不安や気持ちを整え")) {
    return "不安や気持ちを整えたい時に選びやすい神社です。";
  }

  if (s.includes("仕事") || s.includes("転機")) {
    return "仕事や転機を整えたい時に選びやすい神社です。";
  }

  if (s.includes("集中") || s.includes("目標")) {
    return "集中や目標を定めたい時に選びやすい神社です。";
  }

  if (s.includes("良縁") || s.includes("関係性")) {
    return "良縁や関係を整えたい時に選びやすい神社です。";
  }

  if (s.includes("休み") || s.includes("休息")) {
    return "落ち着いて休みたい時に選びやすい神社です。";
  }

  return `${s.replace(/時に$/, "").replace(/たい$/, "たい")}時に選びやすい神社です。`;
}


export default function ShrineConciergeCard({
  shrineId,
  title,
  address,
  description: _description,
  imageUrl,
  explanationSummary,
  explanationPrimaryReason,
  hideDescription = false,
  subtitle: _subtitle,
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
  hideDisclosure: _hideDisclosure = true,
  variant = "list",
  suppressHeroCopy = false,
}: ShrineConciergeCardProps) {
  const isHero = variant === "hero";

  const effHideBadges = isHero ? false : hideBadges;
  const effHideLeftMark = isHero ? true : hideLeftMark;
  const effHideAddress = isHero ? false : hideAddress;
  const effShowFavorite = isHero ? false : showFavorite;
  const effHideDetailLink = hideDetailLink;

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
  const primaryReason = explanationPrimaryReason?.trim() || "";

  const matchedTags = breakdown?.matched_need_tags ?? [];
  const heroClaim = suppressHeroCopy ? "" : buildHeroClaimFromTags(matchedTags);
  const heroReason = hideDescription || suppressHeroCopy ? "" : buildHeroReason(primaryReason);

  const listSubtitle = "";
  const listDescription = hideDescription ? "" : buildListDescriptionFromReason(primaryReason || mainSummary);

  const badges =
    badgesOverride?.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 3) ?? [];

  return (
    <ConciergeCard
      title={title}
      address={addr || undefined}
      imageUrl={imageUrl}
      subtitle={isHero ? heroClaim : listSubtitle}
      description={isHero ? heroReason : listDescription}
      hideBadges={effHideBadges}
      hideLeftMark={effHideLeftMark}
      isPrimary={variant !== "detail"}
      badges={badges}
      detailHref={cardDetailHref}
      detailLabel={isHero ? "この神社を詳しく見る" : "詳細を見る"}
      headerRight={favButton}
      disclosureTitle={undefined}
      disclosureBody={undefined}
      variant={variant}
    />
  );
}
