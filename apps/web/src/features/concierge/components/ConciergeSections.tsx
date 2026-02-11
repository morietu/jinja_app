// apps/web/src/features/concierge/components/ConciergeSections.tsx
"use client";

import * as React from "react";
import type { ConciergeSection } from "@/features/concierge/types/sections";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import PrimaryRecommendationCard from "@/features/concierge/components/PrimaryRecommendationCard";
import RecommendationSwitchList from "@/features/concierge/components/legacy/RecommendationSwitchList";
import DetailSection from "@/components/shrine/DetailSection";
import type { ConciergeModeSignal } from "@/features/concierge/types/unified";
import ModeBadge from "@/features/concierge/components/ModeBadge";

type Props = {
  sections: ConciergeSection[];
  onNewThread?: () => void;
  mode?: ConciergeModeSignal | null;
  initialPrimaryIndex?: number; // 既存互換のため optional
};

function clampIndex(i: number, len: number) {
  if (!Number.isFinite(i)) return 0;
  if (len <= 0) return 0;
  return Math.max(0, Math.min(len - 1, i));
}

export default function ConciergeSections({ sections, onNewThread, mode = null, initialPrimaryIndex = 0 }: Props) {
  if (!Array.isArray(sections) || sections.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md min-w-0 space-y-4">
      {sections.map((sec, i) => {
        if (sec.kind === "note") {
          return (
            <DetailSection key={`note-${i}`} title={sec.title}>
              <div className="text-sm text-slate-700">{sec.text}</div>
            </DetailSection>
          );
        }

        return (
          <PrimarySection
            key={`primary-${i}`}
            sec={sec}
            onNewThread={onNewThread}
            initialIndex={initialPrimaryIndex}
            mode={mode}
          />
        );
      })}
    </div>
  );
}

function PrimarySection({
  sec,
  onNewThread,
  initialIndex,
  mode,
}: {
  sec: Extract<ConciergeSection, { kind: "primary" }>;
  onNewThread?: () => void;
  initialIndex: number;
  mode?: ConciergeModeSignal | null;
}) {
  const items = (Array.isArray(sec.items) ? (sec.items as ConciergeRecommendation[]) : []) as ConciergeRecommendation[];
  const needTags = Array.isArray(sec.needTags) ? sec.needTags : [];

  const safeInit = clampIndex(initialIndex, items.length);
  const [primaryIndex, setPrimaryIndex] = React.useState<number>(
    clampIndex(sec.initialIndex ?? safeInit, items.length),
  );

  React.useEffect(() => {
    setPrimaryIndex(clampIndex(sec.initialIndex ?? safeInit, items.length));
  }, [sec.initialIndex, safeInit, items.length]);

  if (items.length === 0) return null;

  const idx = clampIndex(primaryIndex, items.length);
  const primary = items[idx];

  return (
    <section className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-slate-700">{sec.title}</div>
          <ModeBadge mode={mode} />
        </div>

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

      <div className="mt-2">
        <PrimaryRecommendationCard rec={primary} primaryIndex={idx} needTags={needTags} />
      </div>

      {items.length > 1 ? (
        <div className="mt-3">
          <DetailSection title="他の候補">
            <RecommendationSwitchList items={items} primaryIndex={idx} onPick={setPrimaryIndex} needTags={needTags} />
          </DetailSection>
        </div>
      ) : null}
    </section>
  );
}
