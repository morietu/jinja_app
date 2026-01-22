// apps/web/src/components/concierge/ConciergeBreakdownBody.tsx
"use client";

import * as React from "react";
import type { ConciergeBreakdown } from "@/lib/api/concierge";



function toNum(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function pickReasonLabel(b?: ConciergeBreakdown | null): string | null {
  if (!b) return null;

  const w = b.weights ?? { element: 0, need: 0, popular: 0 };

  const contrib = {
    element: toNum(b.score_element) * toNum(w.element),
    need: toNum(b.score_need) * toNum(w.need),
    popular: toNum(b.score_popular) * toNum(w.popular),
  } as const;

  const entries = Object.entries(contrib) as Array<[keyof typeof contrib, number]>;
  entries.sort((a, c) => c[1] - a[1]);

  const [topKey, topVal] = entries[0] ?? [null, 0];
  if (!topKey || topVal <= 0) return null;

  if (topKey === "need") return (b.matched_need_tags?.length ?? 0) > 0 ? "ご利益が一致" : "希望条件に合う";
  if (topKey === "element") return "雰囲気が合う";
  if (topKey === "popular") return "人気の傾向を考慮";
  return null;
}

export function buildConciergeHint(b?: ConciergeBreakdown | null): string | null {
  if (!b) return null;
  const tags = Array.isArray(b.matched_need_tags) ? b.matched_need_tags.filter(Boolean) : [];
  const head = tags.slice(0, 3).join(" / ");
  return head ? `一致した条件：${head}${tags.length > 3 ? " ほか" : ""}` : "おすすめ理由の内訳があります";
}

type Props = {
  breakdown: ConciergeBreakdown;
};

export default function ConciergeBreakdownBody({ breakdown }: Props) {
  const se = toNum(breakdown.score_element);
  const sn = toNum(breakdown.score_need);
  const sp = toNum(breakdown.score_popular);

  const hasAny = se > 0 || sn > 0 || sp > 0;
  const matched = Array.isArray(breakdown.matched_need_tags) ? breakdown.matched_need_tags.filter(Boolean) : [];
  const shownTags = matched.slice(0, 2);

  if (!hasAny) {
    return <div className="text-xs text-slate-600">条件情報が少ないため、複数要素を総合して表示しています。</div>;
  }

  return (
    <ul className="space-y-1 text-xs text-slate-700">
      {sn > 0 ? (
        <li className="flex flex-wrap items-center gap-1">
          <span className="text-slate-600">ご利益：</span>
          {shownTags.length > 0 ? (
            shownTags.map((t) => (
              <span key={t} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px]">
                {t}
              </span>
            ))
          ) : (
            <span className="text-slate-700">希望条件に合致</span>
          )}
          {matched.length > shownTags.length ? <span className="text-slate-500">ほか</span> : null}
        </li>
      ) : null}

      {se > 0 ? (
        <li>
          <span className="text-slate-600">雰囲気・属性：</span>一致
        </li>
      ) : null}

      {sp > 0 ? (
        <li>
          <span className="text-slate-600">人気：</span>考慮
        </li>
      ) : null}
    </ul>
  );
}
