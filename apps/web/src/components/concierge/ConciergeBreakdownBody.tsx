"use client";

import * as React from "react";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { pickReasonLabel } from "@/lib/concierge/breakdownText";

function toNum(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
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
            <span className="text-slate-700">{pickReasonLabel(breakdown) ?? "希望条件に合致"}</span>
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
