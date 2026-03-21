import React from "react";
import Link from "next/link";
import Image from "next/image";

function formatDistance(m?: number | null) {
  if (typeof m !== "number" || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function clean(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export type ShrineCardProps = {
  name: string;
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
    address,
    recommendReason,
    subReason,
    topReasonLabel,
    primaryReason,
    secondaryReason,
    compatibilityLabels = [],
    distanceM,
    rating,
    reviewCount,
    imageUrl,
    tags = [],
    href,
    isFavorited,
    onToggleFavorite,
    isTopPick = false,
    explanationSummary,
    explanationReasons,
  } = props;

  const distText = formatDistance(distanceM);

  const resolvedSummary = clean(explanationSummary) || clean(recommendReason) || null;

  const resolvedPrimaryReason =
    clean(primaryReason) ||
    (Array.isArray(explanationReasons) ? clean(explanationReasons.find((r) => clean(r?.text))?.text) : null) ||
    null;

  const resolvedSecondaryReason = clean(secondaryReason) || clean(subReason) || null;

  const finalPrimaryReason =
    resolvedPrimaryReason && resolvedPrimaryReason !== resolvedSummary ? resolvedPrimaryReason : null;

  const finalSecondaryReason =
    resolvedSecondaryReason &&
    resolvedSecondaryReason !== resolvedSummary &&
    resolvedSecondaryReason !== finalPrimaryReason
      ? resolvedSecondaryReason
      : null;

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

  const secondaryClass = "mt-1 line-clamp-1 text-[12px] leading-5 text-slate-500";


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
            {isTopPick || topReasonLabel ? (
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
              </div>
            ) : null}

            <div
              className={["truncate font-semibold text-slate-900", isTopPick ? "text-[16px]" : "text-[15px]"].join(" ")}
            >
              {name}
            </div>

            {finalPrimaryReason ? <div className={primaryClass}>{finalPrimaryReason}</div> : null}

            {resolvedSummary ? <div className={summaryClass}>{resolvedSummary}</div> : null}

            {finalSecondaryReason ? <div className={secondaryClass}>{finalSecondaryReason}</div> : null}

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

            {compatibilityLabels.length ? (
              <div className="mt-2 text-[11px] text-slate-400">相性: {compatibilityLabels.join(" / ")}</div>
            ) : null}
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
        <Link href={href} className="block">
          {MainContent}
        </Link>
      ) : (
        MainContent
      )}
    </div>
  );
}

export default ShrineCard;
