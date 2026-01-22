// apps/web/src/features/concierge/components/RecommendationSwitchList.tsx
"use client";

import type { ConciergeRecommendation } from "@/lib/api/concierge";
import { benefitLabel, pickBenefitTagFromRec } from "@/lib/concierge/benefitTag";

type Props = {
  items: ConciergeRecommendation[];
  primaryIndex: number;
  onSelect: (idx: number) => void;
};

export default function RecommendationSwitchList({ items, primaryIndex, onSelect }: Props) {
  if (!items || items.length <= 1) return null;

  return (
    <div className="space-y-2">
      {/* 横スクロールチップ */}
      <div className="-mx-1 overflow-x-auto">
        <ul className="flex gap-2 px-1 pb-1">
          {items.map((r, idx) => {
            if (idx === primaryIndex) return null;

            const tag = benefitLabel(pickBenefitTagFromRec(r));
            const title = (r.display_name || r.name || "").trim() || "（名称不明）";

            return (
              <li key={(r as any).shrine_id ?? r.id ?? (r as any).place_id ?? idx} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(idx)}
                  className={`
                    flex max-w-[220px] items-center gap-2
                    rounded-full px-4 py-2
                    text-left text-sm font-medium
                    bg-white
                    ring-1 ring-inset ring-neutral-200
                    shadow-sm
                    transition
                    hover:bg-neutral-50
                    active:scale-[0.98]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400
                  `}
                >
                  <span className="truncate text-neutral-900">{title}</span>

                  {tag ? (
                    <span
                      className="
                        inline-flex shrink-0
                        rounded-full
                        bg-neutral-100
                        px-2 py-0.5
                        text-[11px] font-semibold
                        text-neutral-700
                        ring-1 ring-inset ring-neutral-200
                      "
                    >
                      {tag}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-[11px] text-neutral-500">タップすると表示中のおすすめを切り替えます</p>
    </div>
  );
}
