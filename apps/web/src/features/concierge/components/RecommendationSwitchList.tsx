"use client";

import type { ConciergeRecommendation } from "@/lib/api/concierge";
import { benefitLabel, pickBenefitTagFromRec } from "@/lib/concierge/benefitTag";

type Props = {
  items: ConciergeRecommendation[];
  primaryIndex: number;
  onSelect: (idx: number) => void;
};

export default function RecommendationSwitchList({
  items,
  primaryIndex,
  onSelect,
}: Props) {
  if (!items || items.length <= 1) return null;

  return (
    <section className="mt-4 rounded-xl border bg-white px-3 py-3">
      <h4 className="text-xs font-semibold text-slate-700">他の候補</h4>

      <ul className="mt-2 space-y-2">
        {items.map((r, idx) => {
          if (idx === primaryIndex) return null;

          const tag = benefitLabel(pickBenefitTagFromRec(r));
          const title = (r.display_name || r.name || "").trim() || "（名称不明）";

          return (
            <li key={(r as any).shrine_id ?? r.id ?? r.place_id ?? idx}>
              <button
                type="button"
                onClick={() => onSelect(idx)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="truncate font-medium text-slate-900">{title}</span>
                {tag && (
                  <span className="ml-2 inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {tag}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[11px] text-slate-500">タップすると1件目を切り替えます</p>
    </section>
  );
}
