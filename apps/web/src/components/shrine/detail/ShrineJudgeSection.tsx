// apps/web/src/components/shrine/detail/ShrineJudgeSection.tsx
import ConciergeBreakdownBody from "@/components/concierge/ConciergeBreakdownBody";

import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

type JudgeSectionItem = {
  key: string;
  title: string;
  body: string;
};

type Props = {
  concierge: ConciergeBreakdown | null;
  exp: ShrineExplanation;
  judgeSection?: {
    title: string;
    lead: string;
    items: JudgeSectionItem[];
  } | null;
};

export default function ShrineJudgeSection({ concierge, exp, judgeSection }: Props) {
  const visibleJudgeItems =
    judgeSection?.items.filter((item) => item.title === "上位になった理由" || item.title === "他候補との差") ?? [];

  return (
    <div className="space-y-3">
      {judgeSection ? (
        visibleJudgeItems.length > 0 ? (
          <div className="space-y-3">
            {visibleJudgeItems.map((item) => {
              const heading = item.title === "上位になった理由" ? "上位理由" : "他候補との差";

              return (
                <div key={item.key} className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500">{heading}</div>
                  <p className="text-sm leading-6 text-slate-800">{item.body}</p>
                </div>
              );
            })}
          </div>
        ) : null
      ) : concierge ? (
        <div className="space-y-2 text-sm text-slate-800">
          <div className="text-xs font-semibold text-slate-500">おすすめ理由（内訳）</div>
          <ConciergeBreakdownBody breakdown={concierge} />
        </div>
      ) : (
        <div className="space-y-2 text-sm text-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-500">合う人</div>
            <p className="mt-1">{exp.fit}</p>
          </div>

          {exp.hasSignal ? (
            <>
              <div>
                <div className="text-xs font-semibold text-slate-500">合いにくい人</div>
                <p className="mt-1">{exp.unfit}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">参拝の使い方</div>
                <p className="mt-1">{exp.howto}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">注意</div>
                <p className="mt-1">{exp.note}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">情報が少ないため、現時点では目安として扱ってください。</p>
          )}
        </div>
      )}
    </div>
  );
}
