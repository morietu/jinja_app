// apps/web/src/features/concierge/components/ConciergeSections.tsx
"use client";

import * as React from "react";
import type { ConciergeSection } from "@/features/concierge/types/sections";
import PrimaryRecommendationCard from "@/features/concierge/components/PrimaryRecommendationCard";
import RecommendationSwitchList from "@/features/concierge/components/RecommendationSwitchList";

type Props = {
  sections: ConciergeSection[];
  onNewThread?: () => void;
  initialPrimaryIndex?: number;
};

export default function ConciergeSections({ sections, onNewThread, initialPrimaryIndex = 0 }: Props) {
  if (!Array.isArray(sections) || sections.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md min-w-0 space-y-4">
      {sections.map((sec, i) => {
        if (sec.kind === "note") {
          return (
            <section key={`note-${i}`} className="rounded-xl border bg-white p-3">
              <div className="text-xs font-semibold text-slate-700">{sec.title}</div>
              <div className="mt-1 text-sm text-slate-700">{sec.text}</div>
            </section>
          );
        }

        // sec.kind === "primary"
        return (
          <PrimarySection key={`primary-${i}`} sec={sec} onNewThread={onNewThread} initialIndex={initialPrimaryIndex} />
        );
      })}
    </div>
  );
}

function PrimarySection({
  sec,
  onNewThread,
  initialIndex,
}: {
  sec: Extract<ConciergeSection, { kind: "primary" }>;
  onNewThread?: () => void;
  initialIndex: number;
}) {
  const items = Array.isArray(sec.items) ? sec.items : [];
  const needTags = Array.isArray(sec.needTags) ? sec.needTags : [];

  const safeInit = Number.isFinite(initialIndex) ? Math.max(0, Math.min(items.length - 1, initialIndex)) : 0;
  const [primaryIndex, setPrimaryIndex] = React.useState<number>(sec.initialIndex ?? safeInit);

  React.useEffect(() => {
    setPrimaryIndex(sec.initialIndex ?? safeInit);
  }, [sec.initialIndex, safeInit]);

  if (items.length === 0) return null;

  const primary = items[Math.max(0, Math.min(items.length - 1, primaryIndex))];

  return (
    <section className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700">{sec.title}</div>

        {onNewThread ? (
          <button
            type="button"
            onClick={onNewThread}
            className="text-[11px] font-semibold text-emerald-700 hover:underline"
          >
            条件を追加して絞る
          </button>
        ) : null}
      </div>

      {/* ✅ primary（= 1件目表示） */}
      <div className="mt-2">
        <PrimaryRecommendationCard rec={primary} primaryIndex={primaryIndex} needTags={needTags} />
      </div>

      {/* ✅ スイッチ（候補が2つ以上の時だけ） */}
      <RecommendationSwitchList items={items} primaryIndex={primaryIndex} onSelect={setPrimaryIndex} />
    </section>
  );
}
