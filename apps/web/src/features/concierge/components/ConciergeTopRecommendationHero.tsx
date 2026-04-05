"use client";

import Link from "next/link";
import Image from "next/image";

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
  tags?: string[];
  routeLabel?: string;
  onRouteClick?: () => void;
};

const heroCardClass = "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm";
const heroBodyClass = "p-6";
const subtleTextClass = "text-xs leading-6 text-slate-500";
const bodyTextClass = "text-sm leading-7 text-slate-700";

export default function ConciergeTopRecommendationHero({
  name,
  href,
  imageUrl = null,
  address = null,
  topReasonLabel = null,
  catchCopy,
  whyTop = null,
  primaryReason,
  secondaryReason = null,
  differenceFromOthers = null,
  tags = [],
  routeLabel = "経路案内",
  onRouteClick,
}: Props) {
  const safeTags = tags.filter(Boolean).slice(0, 3);

  return (
    <article className={heroCardClass}>
      {imageUrl ? (
        <div className="relative h-48 w-full bg-slate-100">
          <Image src={imageUrl} alt={name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 448px" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      ) : (
        <div className="h-24 w-full bg-gradient-to-b from-stone-50 to-white" />
      )}

      <div className={heroBodyClass}>
        <div className="space-y-4">
          {topReasonLabel ? (
            <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {topReasonLabel}
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">{name}</h3>

            <p className="text-base font-semibold leading-7 text-slate-900">{catchCopy}</p>

            {address ? <p className={subtleTextClass}>{address}</p> : null}
          </div>

          {whyTop ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-semibold leading-7 text-emerald-900">{whyTop}</p>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">この神社が出てきた理由</p>
              <p className={bodyTextClass}>{primaryReason}</p>
            </div>

            {secondaryReason ? <p className={bodyTextClass}>{secondaryReason}</p> : null}

            {differenceFromOthers ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm leading-7 text-slate-700">{differenceFromOthers}</p>
              </div>
            ) : null}
          </div>

          {safeTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {safeTags.map((tag) => (
                <span key={tag} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 pt-1">
            {href ? (
              <Link
                href={href}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                詳細を見る
              </Link>
            ) : (
              <span className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">
                詳細準備中
              </span>
            )}

            <button
              type="button"
              onClick={onRouteClick}
              disabled={!onRouteClick}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {routeLabel}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
