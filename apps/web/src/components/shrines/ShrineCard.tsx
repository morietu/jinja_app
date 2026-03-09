import React from "react";
import Link from "next/link";
import Image from "next/image";

function formatDistance(m?: number | null) {
  if (typeof m !== "number" || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

export type ShrineCardProps = {
  name: string;
  address?: string | null;
  recommendReason?: string | null;
  subReason?: string | null;
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

  const maxReasonCount = isTopPick ? 3 : 2;

  const cleanReasons = Array.isArray(explanationReasons)
    ? explanationReasons.filter((r) => r && (r.label || r.text)).slice(0, maxReasonCount)
    : [];

  console.log({
    name,
    isTopPick,
    explanationReasons,
    cleanReasons,
  });

  const hasExplanation = Boolean((explanationSummary && explanationSummary.trim()) || cleanReasons.length > 0);

  const cardClass = ["rounded-xl border p-4", isTopPick ? "border-amber-300 bg-amber-50/40" : "bg-white"].join(" ");

  const MainContent = (
    <div className="flex gap-4">
      <div className="w-28 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={112} height={80} className="w-full h-full object-cover" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {isTopPick ? (
              <div className="mb-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                いちばんおすすめ
              </div>
            ) : null}

            <div className="font-semibold truncate">{name}</div>

            {recommendReason ? <div className="mt-1 text-sm text-gray-800 line-clamp-2">{recommendReason}</div> : null}

            {distText || typeof rating === "number" ? (
              <div className="mt-2 flex gap-3 text-sm text-gray-700">
                {distText ? <span>{distText}</span> : null}
                {typeof rating === "number" ? (
                  <span>
                    {rating.toFixed(1)}
                    {typeof reviewCount === "number" ? ` (${reviewCount})` : ""}
                  </span>
                ) : null}
              </div>
            ) : null}

            {address ? <div className="mt-1 text-xs text-gray-500 truncate">{address}</div> : null}

            {compatibilityLabels.length ? (
              <div className="mt-1 text-[11px] text-gray-500">相性: {compatibilityLabels.join(" / ")}</div>
            ) : null}

            {subReason ? <div className="mt-1 text-[11px] text-gray-500 line-clamp-1">{subReason}</div> : null}
          </div>

          {typeof isFavorited === "boolean" && onToggleFavorite ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite?.();
              }}
              className="text-sm px-2 py-1 border rounded-md shrink-0"
              aria-label={isFavorited ? "お気に入り解除" : "お気に入り追加"}
            >
              {isFavorited ? "★" : "☆"}
            </button>
          ) : null}
        </div>

        {tags.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.slice(0, 5).map((t) => (
              <span key={t} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  const ExplanationContent = hasExplanation ? (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <details open={isTopPick} className="group">
        <summary className="list-none cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800 flex items-center justify-between">
          <span>なぜこの神社？</span>
          <span className="text-slate-400 text-[10px] transition-transform group-open:rotate-180">▲</span>
        </summary>

        <div className="mt-2 space-y-2">
          {cleanReasons.length ? (
            <ul className="space-y-1">
              {cleanReasons.map((reason, idx) => (
                <li key={`${reason.code ?? "reason"}_${idx}`} className="text-[11px] leading-5 text-slate-600">
                  {reason.label ? (
                    <>
                      <span className="text-slate-400">{reason.label}</span>
                      <span className="mx-1 text-slate-300">-</span>
                    </>
                  ) : null}
                  <span>{reason.text}</span>
                </li>
              ))}
            </ul>
          ) : explanationSummary ? (
            <div className="text-[11px] leading-5 text-slate-600">{explanationSummary}</div>
          ) : null}
        </div>
      </details>
    </div>
  ) : null;

  return (
    <div className={cardClass}>
      {href ? (
        <Link href={href} className="block">
          {MainContent}
        </Link>
      ) : (
        MainContent
      )}

      {ExplanationContent}
    </div>
  );
}

export default ShrineCard;
