// apps/web/src/components/shrines/ShrineCardCompact.tsx

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

export type ShrineCardCompactProps = {
  name: string;
  href?: string | null;
  imageUrl?: string | null;
  address?: string | null;
  summary?: string | null;
  primaryReason?: string | null;
  tags?: string[];
  distanceM?: number | null;
};

export default function ShrineCardCompact({
  name,
  href = null,
  imageUrl = null,
  address = null,
  summary = null,
  primaryReason = null,
  tags = [],
  distanceM = null,
}: ShrineCardCompactProps) {
  const distText = formatDistance(distanceM);
  const resolvedPrimaryReason = clean(primaryReason) || null;
  const resolvedSummary = clean(summary) && clean(summary) !== resolvedPrimaryReason ? clean(summary) : null;

  const visibleTags = tags.filter(Boolean).slice(0, 1);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} width={80} height={64} className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="space-y-1">
            <h3 className="truncate text-[15px] font-semibold text-slate-900">{name}</h3>

            {resolvedPrimaryReason ? (
              <p className="line-clamp-2 text-[13px] leading-6 text-slate-700">{resolvedPrimaryReason}</p>
            ) : null}

            {resolvedSummary ? (
              <p className="line-clamp-1 text-[12px] leading-5 text-slate-500">{resolvedSummary}</p>
            ) : null}
          </div>

          {address || distText || visibleTags.length > 0 || href ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              {address ? <span className="truncate text-xs text-slate-500">{address}</span> : null}

              {!address && distText ? <span className="text-xs text-slate-500">{distText}</span> : null}

              {visibleTags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                  {tag}
                </span>
              ))}

              {href ? (
                <Link
                  href={href}
                  className="ml-auto inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
                >
                  → 詳細
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
