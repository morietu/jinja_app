// apps/web/src/components/shrine/detail/ShrineJudgeSection.tsx
import DetailSection from "@/components/shrine/DetailSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";
import ConciergeBreakdownBody, { buildConciergeHint } from "@/components/concierge/ConciergeBreakdownBody";
import { buildOneLiner } from "@/lib/concierge/pickAClause";

import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel } from "@/lib/shrine/buildShrineExplanation";

export default function ShrineJudgeSection({
  judgeTitle,
  judgeLevel,
  judgeSummary,
  judgeHint,
  concierge,
  exp,
}: {
  judgeTitle: string;
  judgeLevel: SignalLevel;
  judgeSummary: string;
  judgeHint: string | null;
  concierge: ConciergeBreakdown | null;
  exp: {
    hasSignal: boolean;
    fit: string;
    unfit: string;
    howto: string;
    note: string;
    summary: string;
    strongHint: string | null;
    signalLevel: SignalLevel;
  };
}) {
  const useConcierge = concierge !== null;

  // 念のため: 呼び出し側が summary/hint を作ってても壊れないように整形
  const summary = judgeSummary || (useConcierge ? buildOneLiner(concierge!) : exp.summary);
  const hint = judgeHint ?? (useConcierge ? buildConciergeHint(concierge!) : exp.strongHint);

  return (
    <DetailSection title="説明">
      <DetailDisclosureBlock title={judgeTitle} summary={summary} level={judgeLevel} hint={hint}>
        {useConcierge ? (
          <div className="space-y-2 text-sm text-slate-800">
            <div className="text-xs font-semibold text-slate-500">おすすめ理由（内訳）</div>
            <ConciergeBreakdownBody breakdown={concierge!} />
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-500">合う人</div>
              <p className="line-clamp-3">{exp.fit}</p>
            </div>

            {exp.hasSignal ? (
              <>
                <div>
                  <div className="text-xs font-semibold text-slate-500">合いにくい人</div>
                  <p className="mt-1 line-clamp-3">{exp.unfit}</p>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-500">参拝の使い方</div>
                  <p className="mt-1 line-clamp-3">{exp.howto}</p>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-500">注意</div>
                  <p className="mt-1 line-clamp-3">{exp.note}</p>
                </div>
              </>
            ) : (
              <div className="space-y-2 text-sm text-slate-800">
                <p className="text-xs text-slate-500">情報が少ないため、現時点では目安として扱ってください。</p>
                <p className="line-clamp-3">{exp.note}</p>
              </div>
            )}
          </div>
        )}
      </DetailDisclosureBlock>
    </DetailSection>
  );
}
