// apps/web/src/features/concierge/components/ConciergeSections.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeSection } from "@/features/concierge/types/sections";

type Props = {
  sections: ConciergeSection[];
};

export default function ConciergeSections({ sections }: Props) {
  if (!sections?.length) return null;

  return (
    <section className="shrink-0 border-t bg-white px-3 py-3">
      <div className="flex flex-col gap-4">
        {sections.map((section, idx) => {
          switch (section.kind) {
            case "primary": {
              const first = section.items?.[0];
              if (!first) return null;

              return (
                <div key={idx}>
                  <div className="mb-2 text-xs font-semibold text-slate-700">{section.title}</div>
                  <ConciergeCard key={(first as any).id ?? (first as any).place_id ?? idx} s={first as any} index={0} />
                </div>
              );
            }

            case "recommendations": {
              const items = section.items ?? [];
              if (items.length === 0) return null;

              return (
                <div key={idx}>
                  {section.title ? (
                    <div className="mb-2 text-xs font-semibold text-slate-700">{section.title}</div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    {items.map((rec, i) => (
                      <ConciergeCard key={(rec as any).id ?? (rec as any).place_id ?? i} s={rec as any} index={i} />
                    ))}
                  </div>
                </div>
              );
            }

            default:
              return null;
          }
        })}
      </div>
    </section>
  );
}
