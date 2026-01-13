// apps/web/src/components/ConciergeCard.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { pickBenefitTagFromRec, benefitLabel } from "@/lib/concierge/benefitTag";
import { LABELS } from "@/lib/ui/labels";

type Props = {
  s: Shrine;
  index?: number;
};

type Shrine = {
  name: string;
  display_name?: string | null;
  address?: string | null;
  display_address?: string | null;

  lat?: number | null;
  lng?: number | null;
  location?: { lat?: number | null; lng?: number | null } | string | null;

  id?: number | null;
  place_id?: string | null;
  reason?: string | null;
  photo_url?: string | null;

  distance_m?: number | null;
  duration_min?: number | null;
};

export default function ConciergeCard({ s, index = 0 }: Props) {
  const isPrimary = index === 0;

  const title = (s.display_name || s.name || "").trim() || "（名称不明）";
  const addrText = (s.display_address ?? s.address ?? null)?.toString().trim() || null;
  const reasonText = (typeof s.reason === "string" ? s.reason.trim() : "") || "まずは代表的な候補から表示しています。";
  const tag = benefitLabel(pickBenefitTagFromRec(s as any));

  // tid を拾う（/concierge?tid=... を維持）
  const sp = useSearchParams();
  const tid = sp.get("tid");

  // ctx + tid を運ぶ
  const qs = new URLSearchParams();
  qs.set("ctx", "concierge");
  if (tid) qs.set("tid", tid);

  const sid = typeof s.id === "number" ? s.id : Number(s.id ?? NaN);
  const hasDbId = Number.isFinite(sid) && sid > 0;

  // ✅ 詳細導線はここだけ：DBなら hub、なければ from-place
  const detailHref = hasDbId
    ? `/shrines/hub/${sid}?${qs.toString()}`
    : s.place_id
      ? `/shrines/from-place/${encodeURIComponent(s.place_id)}?${qs.toString()}`
      : null;

  return (
    <div className="rounded-xl border bg-white px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {!!s.photo_url && (
        <div className="relative mb-3 h-36 w-full">
          <Image
            src={s.photo_url}
            alt={title}
            fill
            className="rounded-lg object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
            priority={isPrimary}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
          <span className="text-sm text-gray-500">{isPrimary ? "★" : "◎"}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          {addrText && <p className="mt-1 truncate text-sm text-gray-600">{addrText}</p>}

          <p className="mt-2 line-clamp-3 text-sm text-gray-800">
            {tag && (
              <span className="mr-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {tag}
              </span>
            )}
            {reasonText}
          </p>

          {typeof s.distance_m === "number" && typeof s.duration_min === "number" && (
            <p className="mt-2 text-xs text-gray-600">
              距離 {(s.distance_m / 1000).toFixed(1)} km ・ 目安 {s.duration_min} 分
            </p>
          )}

          {detailHref && (
            <div className="mt-3">
              <Link
                href={detailHref}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {LABELS.shrineDetail}
              </Link>
            </div>
          )}

          {/* ✅ /map への導線はこのカードから完全排除 */}
        </div>
      </div>
    </div>
  );
}
