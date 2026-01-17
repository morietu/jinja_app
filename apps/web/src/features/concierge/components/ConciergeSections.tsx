// apps/web/src/features/concierge/components/ConciergeSections.tsx
"use client";

import type { ConciergeSection } from "@/features/concierge/types/sections";
import PrimaryRecommendationCard from "@/features/concierge/components/PrimaryRecommendationCard";

type Props = {
  sections: ConciergeSection[];
};

export default function ConciergeSections({ sections }: Props) {
  if (!sections || sections.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-3 pb-4">
      {sections.map((sec, i) => {
        if (sec.kind !== "primary") return null;

        return (
          <section key={`${sec.kind}-${i}`} className="rounded-2xl border bg-white p-3 shadow-sm">
            <div className="text-xs font-semibold text-slate-700">{sec.title}</div>

            <div className="mt-2 space-y-3">
              {sec.items.slice(0, 3).map((rec, idx) => (
                <PrimaryRecommendationCard
                  key={`${i}-${idx}`}
                  rec={rec}
                  primaryIndex={idx}
                  needTags={sec.needTags ?? []}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
