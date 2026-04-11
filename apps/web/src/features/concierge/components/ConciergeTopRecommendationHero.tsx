"use client";

import Link from "next/link";

type Props = {
  name: string;
  href?: string | null;
  imageUrl?: string | null;
  address?: string | null;
  topReasonLabel?: string | null;
  catchCopy: string;
  whyTop?: string | null;
  primaryReason: string;
  secondaryReason?: string | null;
  differenceFromOthers?: string | null;
  nextActionHint?: string | null;
  tags?: string[];
  routeLabel?: string;
  onRouteClick?: () => void;
};

export default function ConciergeTopRecommendationHero({
  name,
  href = null,
  imageUrl: _imageUrl = null,
  address = null,
  topReasonLabel = null,
  catchCopy,
  whyTop = null,
  primaryReason,
  secondaryReason = null,
  differenceFromOthers = null,
  nextActionHint = null,
  tags = [],
  routeLabel = "経路案内",
  onRouteClick,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {topReasonLabel ? (
        <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
          {topReasonLabel}
        </div>
      ) : null}

      <div className="text-base font-semibold text-slate-900">{name}</div>

      {address ? <div className="mt-1 text-xs text-slate-500">{address}</div> : null}

      <div className="mt-2 text-sm text-slate-700">{catchCopy}</div>

      {whyTop ? <div className="mt-3 text-sm text-slate-700">{whyTop}</div> : null}
      {primaryReason ? <div className="mt-2 text-sm text-slate-700">{primaryReason}</div> : null}
      {secondaryReason ? <div className="mt-2 text-sm text-slate-600">{secondaryReason}</div> : null}
      {differenceFromOthers ? <div className="mt-2 text-sm text-slate-600">{differenceFromOthers}</div> : null}
      {nextActionHint ? <div className="mt-2 text-sm text-slate-600">{nextActionHint}</div> : null}

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        {href ? (
          <Link href={href} className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">
            詳細を見る
          </Link>
        ) : null}

        {onRouteClick ? (
          <button
            type="button"
            onClick={onRouteClick}
            className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white"
          >
            {routeLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
