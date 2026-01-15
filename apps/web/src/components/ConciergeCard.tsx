// apps/web/src/components/ConciergeCard.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { pickBenefitTagFromRec, benefitLabel } from "@/lib/concierge/benefitTag";
import { LABELS } from "@/lib/ui/labels";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import { labelNeedTag } from "@/features/concierge/needTagLabel";

type Props = {
  s: ConciergeRecommendation;
  index?: number;
  toneTexts?: string[];
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-4 text-neutral-500 transition-transform duration-200", open && "rotate-180")}
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function fmtDistanceDuration(distance_m?: number | null, duration_min?: number | null) {
  const d = typeof distance_m === "number" && Number.isFinite(distance_m) ? distance_m : null;
  const t = typeof duration_min === "number" && Number.isFinite(duration_min) ? duration_min : null;
  if (d == null && t == null) return null;

  const km = d != null ? (d / 1000).toFixed(1) : null;
  if (t != null && km != null) return `現在地から目安 ${t} 分（${km} km）`;
  if (t != null) return `現在地から目安 ${t} 分`;
  if (km != null) return `現在地から約 ${km} km`;
  return null;
}

export default function ConciergeCard({ s, index = 0, toneTexts }: Props) {
  const isPrimary = index === 0;
  const [open, setOpen] = React.useState(false);

  const title = (s.display_name || s.name || "").trim() || "（名称不明）";
  const addrText = (s.display_address ?? s.address ?? null)?.toString().trim() || null;

  // backend reason を主：無い時だけ補助
  const reasonText = (typeof s.reason === "string" ? s.reason.trim() : "") || "まずは代表的な候補から表示しています。";

  const benefit = benefitLabel(pickBenefitTagFromRec(s));
  const distanceText = fmtDistanceDuration(s.distance_m, s.duration_min);

  // tid を拾う（/concierge?tid=... を維持）
  const sp = useSearchParams();
  const tid = sp.get("tid");

  // ctx + tid を運ぶ
  const qs = new URLSearchParams();
  qs.set("ctx", "concierge");
  if (tid) qs.set("tid", tid);

  const sid = typeof s.id === "number" ? s.id : Number(s.id ?? NaN);
  const hasDbId = Number.isFinite(sid) && sid > 0;

  // 詳細導線：DBなら hub、なければ from-place
  const detailHref = hasDbId
    ? `/shrines/hub/${sid}?${qs.toString()}`
    : s.place_id
      ? `/shrines/from-place/${encodeURIComponent(s.place_id)}?${qs.toString()}`
      : null;

  const matchedNeeds = (s.breakdown?.matched_need_tags ?? []).filter(Boolean);
  const matchedNeedsLabel = matchedNeeds.length ? matchedNeeds.map(labelNeedTag).join(" / ") : null;

  // ✅ トーンは「1件目だけ」出す（最大2）
  const tone = isPrimary ? (toneTexts ?? []).filter(Boolean).slice(0, 2) : [];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      {!!s.photo_url && (
        <div className="relative h-36 w-full">
          <Image
            src={s.photo_url}
            alt={title}
            fill
            className="rounded-t-xl object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
            priority={isPrimary}
          />
        </div>
      )}

      {/* ✅ “優先度表現 + 余白差” */}
      <div className={cn("px-3", isPrimary ? "py-3" : "py-2")}>
        {/* 上部ラベル（優先度表現 + benefit） */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              isPrimary
                ? "border-slate-300 bg-slate-50 text-slate-800"
                : "border-neutral-200 bg-white text-neutral-700",
            )}
          >
            {isPrimary ? "AIの提案（最優先）" : "AIの提案（候補）"}
          </span>

          {benefit ? (
            <span className="inline-flex shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
              {benefit}
            </span>
          ) : null}
        </div>

        {/* タイトル・住所 */}
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100">
            <span className="text-sm text-neutral-500">{isPrimary ? "★" : "◎"}</span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">{title}</h3>
            {addrText && <p className="mt-0.5 truncate text-xs text-neutral-600">{addrText}</p>}

            {/* ✅ ここを差し替え（候補は軽く、1件目は読ませる） */}
            <p
              className={cn(
                "mt-2 text-sm leading-relaxed text-neutral-800",
                !isPrimary && "line-clamp-1 text-neutral-700",
              )}
            >
              {reasonText}
            </p>

            {!isPrimary && <span className="mt-1 inline-block text-[10px] text-neutral-500">AIの提案（候補）</span>}

            {isPrimary && tone.length > 0 && (
              <div className="mt-2 border-l-2 border-neutral-200 pl-2">
                {tone.map((t) => (
                  <p key={t} className="text-sm leading-relaxed text-neutral-700">
                    {t}
                  </p>
                ))}
              </div>
            )}

            {/* CTA */}
            {detailHref && (
              <div className={cn("mt-3", !isPrimary && "mt-2")}>
                <Link
                  href={detailHref}
                  className={cn(
                    "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition",
                    "bg-neutral-900 text-white hover:bg-neutral-800",
                  )}
                >
                  {LABELS.shrineDetail ?? "詳細を見る"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 根拠（折りたたみ / 初期は閉） */}
      <div className="border-t border-neutral-200">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-neutral-50"
          aria-expanded={open}
        >
          <span className="text-xs font-semibold text-neutral-800">この神社を提案した理由</span>
          <Chevron open={open} />
        </button>

        {open && (
          <div className="px-3 pb-3 pt-1">
            <div className="space-y-2.5">
              {/* 相談内容 */}
              <div>
                <div className="text-[11px] font-semibold text-neutral-500">相談内容</div>
                <div className="mt-0.5 text-sm leading-relaxed text-neutral-800">
                  {matchedNeedsLabel ?? "（この相談内容との一致は集計中です）"}
                </div>
              </div>

              {/* 状況（トーンは1件目のみ） */}
              <div>
                <div className="text-[11px] font-semibold text-neutral-500">状況</div>
                <div className="mt-0.5 space-y-1 text-sm leading-relaxed text-neutral-800">
                  {isPrimary && tone.length > 0 ? (
                    tone.map((t) => <div key={t}>{t}</div>)
                  ) : (
                    <div className="text-neutral-600">—</div>
                  )}
                </div>
              </div>

              {/* 距離 */}
              <div>
                <div className="text-[11px] font-semibold text-neutral-500">距離</div>
                <div className="mt-0.5 text-sm leading-relaxed text-neutral-800">{distanceText ?? "—"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
