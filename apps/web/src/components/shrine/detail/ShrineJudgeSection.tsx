// apps/web/src/components/shrine/detail/ShrineJudgeSection.tsx
import ConciergeBreakdownBody from "@/components/concierge/ConciergeBreakdownBody";

import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel, ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

type Props = {
  judgeTitle: string;
  judgeLevel: SignalLevel | "low"; // 現実を受け止める
  judgeSummary: string;
  judgeHint: string | null;

  concierge: ConciergeBreakdown | null;
  exp: ShrineExplanation;
};

function headTags(tags: string[], n = 3) {
  const a = tags.filter(Boolean);
  const head = a.slice(0, n).join(" / ");
  return head ? `${head}${a.length > n ? " ほか" : ""}` : "";
}

function levelLabel(level: SignalLevel) {
  if (level === "strong") return "高";
  if (level === "medium") return "中";
  return "低";
}

export default function ShrineJudgeSection(props: Props) {
  const { judgeLevel, concierge, exp } = props;

  // ✅ level normalize（low という異物は weak 扱いで潰す）
  const lv: SignalLevel = judgeLevel === "low" ? "weak" : judgeLevel;

  const matched = Array.isArray(concierge?.matched_need_tags) ? concierge!.matched_need_tags : [];
  const matchedText = headTags(matched, 3);

  const goshuinsCount = exp?.signals?.publicGoshuinsCount;
  const goshuinsText = typeof goshuinsCount === "number" ? `${goshuinsCount}件` : "未計測";

  const basisText =
    matched.length > 0 ? `ご利益タグが一致（${levelLabel(lv)}）` : `希望条件に合う（${levelLabel(lv)}）`;

  return (
    <div className="space-y-3">
      {/* ✅ 材料カード（最小3点） */}
      <div className="rounded-xl border bg-white p-3">
        <div className="text-xs font-semibold text-slate-700">材料</div>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {matchedText ? <li>一致：{matchedText}</li> : <li>一致：なし</li>}
          <li>公開御朱印：{goshuinsText}</li>
          <li>根拠：{basisText}</li>
        </ul>
      </div>

      {/* ✅ 中身：conciergeがあれば内訳、なければexp */}
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
