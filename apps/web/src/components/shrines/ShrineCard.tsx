import React from "react";
import Link from "next/link";
import Image from "next/image";
import { trackSearchEvent } from "@/lib/analytics/searchEvents";

function formatDistance(m?: number | null) {
  if (typeof m !== "number" || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function clean(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

const BENEFIT_PROMPTS: Record<string, string> = {
  縁結び: "人とのご縁や関係性を整えたい時の候補です。",
  "子宝・安産": "家族や新しい命に関する願いを大切にしたい時の候補です。",
  学業成就: "学びや試験に向けて気持ちを整えたい時の候補です。",
  合格祈願: "試験や選考など、結果に向けて集中したい時の候補です。",
  "金運・商売繁盛": "仕事やお金の流れを整えたい時の候補です。",
  "仕事運・出世": "仕事の前進や役割の変化を意識したい時の候補です。",
  健康長寿: "心身の健やかさを大切にしたい時の候補です。",
  病気平癒: "回復や体調面への願いを込めたい時の候補です。",
  家内安全: "家族や暮らしの安心を大切にしたい時の候補です。",
  交通安全: "移動や日々の安全を意識したい時の候補です。",
  "厄除け・方除け": "不安や節目を切り替えたい時の候補です。",
  "勝運・必勝祈願": "挑戦や勝負どころに向けて気持ちを整えたい時の候補です。",
  五穀豊穣: "実りや日々の恵みに意識を向けたい時の候補です。",
  地域安泰: "土地や地域とのつながりを大切にしたい時の候補です。",
  開運招福: "流れを変えたい時や、前向きなきっかけが欲しい時の候補です。",
};

function buildBenefitPrompt(tags: string[]) {
  const firstTag = tags.map((tag) => clean(tag)).find(Boolean);
  if (!firstTag) return null;
  return BENEFIT_PROMPTS[firstTag] ?? `${firstTag}を意識して参拝先を選びたい時の候補です。`;
}

export type ShrineCardProps = {
  name: string;
  shrineId?: string | number;
  address?: string | null;

  recommendReason?: string | null;
  subReason?: string | null;

  topReasonLabel?: string | null;
  primaryReason?: string | null;
  secondaryReason?: string | null;

  compatibilityLabels?: string[];
  distanceM?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  imageUrl?: string | null;
  tags?: string[];
  href?: string;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  isTopPick?: boolean;
  /** DBへ最近追加された神社かどうか。判定は lib/shrine/isNewShrine.ts が行う。 */
  isNew?: boolean;

  explanationSummary?: string | null;
  explanationReasons?: Array<{
    code?: string | null;
    label?: string | null;
    text?: string | null;
    strength?: "low" | "mid" | "high" | null;
  }> | null;
};

export function ShrineCard(props: ShrineCardProps) {
  const {
    name,
    shrineId,
    address,
    recommendReason,
    subReason: _subReason,
    topReasonLabel,
    primaryReason,
    secondaryReason: _secondaryReason,
    compatibilityLabels: _compatibilityLabels = [],
    distanceM,
    rating,
    reviewCount,
    imageUrl,
    tags = [],
    href,
    isFavorited,
    onToggleFavorite,
    isTopPick = false,
    isNew = false,
    explanationSummary,
    explanationReasons,
  } = props;

  const distText = formatDistance(distanceM);

  const benefitPrompt = buildBenefitPrompt(tags);
  const resolvedSummary = clean(explanationSummary) || clean(recommendReason) || benefitPrompt;

  const resolvedPrimaryReason =
    clean(primaryReason) ||
    (Array.isArray(explanationReasons) ? clean(explanationReasons.find((r) => clean(r?.text))?.text) : null) ||
    null;

  const finalPrimaryReason =
    resolvedPrimaryReason && resolvedPrimaryReason !== resolvedSummary ? resolvedPrimaryReason : null;

  const cardClass = [
    "rounded-2xl border p-4 shadow-sm transition-colors",
    isTopPick ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white",
  ].join(" ");

  const summaryClass = [
    "mt-2 line-clamp-1",
    isTopPick ? "text-[12px] leading-5 text-slate-500" : "text-[12px] leading-5 text-slate-600",
  ].join(" ");

  const primaryClass = [
    "mt-1 line-clamp-2",
    isTopPick
      ? "text-[14px] font-semibold leading-6 text-slate-900"
      : "text-[13px] font-medium leading-6 text-slate-700",
  ].join(" ");

  const MainContent = (
    <div className="flex gap-4">
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={112} height={80} className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {isTopPick || topReasonLabel || isNew ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {isTopPick ? (
                  <div className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    いちばんおすすめ
                  </div>
                ) : null}

                {topReasonLabel ? (
                  <div className="inline-flex rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    {topReasonLabel}
                  </div>
                ) : null}

                {/* 情報補助のため「いちばんおすすめ」より弱い視覚階層に留める（中立色・非semibold）。 */}
                {isNew ? (
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    新着
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              className={["truncate font-semibold text-slate-900", isTopPick ? "text-[16px]" : "text-[15px]"].join(" ")}
            >
              {name}
            </div>

            {finalPrimaryReason ? <div className={primaryClass}>{finalPrimaryReason}</div> : null}

            {resolvedSummary ? (
              <div className={summaryClass}>
                <span className="font-semibold text-emerald-700">選ぶ理由：</span>
                {resolvedSummary}
              </div>
            ) : null}

            {distText || typeof rating === "number" ? (
              <div className="mt-2 flex gap-3 text-sm text-slate-600">
                {distText ? <span>{distText}</span> : null}
                {typeof rating === "number" ? (
                  <span>
                    {rating.toFixed(1)}
                    {typeof reviewCount === "number" ? ` (${reviewCount})` : ""}
                  </span>
                ) : null}
              </div>
            ) : null}

            {address ? <div className="mt-1 truncate text-xs text-slate-500">{address}</div> : null}
          </div>

          {typeof isFavorited === "boolean" && onToggleFavorite ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite?.();
              }}
              className="shrink-0 rounded-md border px-2 py-1 text-sm"
              aria-label={isFavorited ? "お気に入り解除" : "お気に入り追加"}
            >
              {isFavorited ? "★" : "☆"}
            </button>
          ) : null}
        </div>

        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={cardClass}>
      {href ? (
        <Link
          href={href}
          className="block"
          onClick={() => {
            trackSearchEvent("shrine_card_click", {
              source: "shrines",
              shrineId,
            });
          }}
        >
          {MainContent}
        </Link>
      ) : (
        MainContent
      )}
    </div>
  );
}

export default ShrineCard;
