// apps/web/src/components/shrine/detail/ShrineJudgeSection.tsx
import DetailSection from "@/components/shrine/DetailSection";
import DetailDisclosureBlock from "@/components/shrine/DetailDisclosureBlock";
import ConciergeBreakdownBody from "@/components/concierge/ConciergeBreakdownBody";

import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel } from "@/lib/shrine/buildShrineExplanation";

type Exp = {
  hasSignal: boolean;
  fit: string;
  unfit: string;
  howto: string;
  note: string;
  summary: string;
  strongHint: string | null;
  signalLevel: SignalLevel;
};

type Props = {
  judgeTitle: string;
  judgeLevel: SignalLevel | "low"; // ← "low" が混じる現実に合わせる
  judgeSummary: string;
  judgeHint: string | null;

  concierge: ConciergeBreakdown | null;
  exp: Exp;
};

export default function ShrineJudgeSection(props: Props) {
  const { judgeTitle, judgeLevel, judgeSummary, judgeHint, concierge, exp } = props;
  const useConcierge = concierge !== null;

  return (
    <DetailSection title="説明">
      <DetailDisclosureBlock title={judgeTitle} summary={judgeSummary} level={judgeLevel} hint={judgeHint}>
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
