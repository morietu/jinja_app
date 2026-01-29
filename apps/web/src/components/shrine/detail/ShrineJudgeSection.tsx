// apps/web/src/components/shrine/detail/ShrineJudgeSection.tsx
import ConciergeBreakdownBody from "@/components/concierge/ConciergeBreakdownBody";

import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

type Props = {
  concierge: ConciergeBreakdown | null;
  exp: ShrineExplanation;
};

export default function ShrineJudgeSection({ concierge, exp }: Props) {
  return (
    <div className="space-y-3">
      {concierge ? (
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
