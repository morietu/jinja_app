"use client";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import NeedChips from "@/features/concierge/components/NeedChips";

// どこかに置く（このファイルでもOK / 別ファイルでもOK）
const TONE_TEXT = {
  adjust: [
    "今の状態から一歩動くなら、選びやすい選択肢のひとつです。",
    "大きな決断ではなく、状況を整える行動として向いています。",
  ],
  reflect: [
    "今後の方向性を考える材料として、検討に向いています。",
    "判断を急がず、選択肢を見直すタイミングに合っています。",
  ],
} as const;

type ToneKey = keyof typeof TONE_TEXT;

function pickTone(rec: ConciergeRecommendation): ToneKey {
  const needScore = rec.breakdown?.score_need ?? 0;
  // elemScore を使うならここで（今は未使用でOK）
  // const elemScore = rec.breakdown?.score_element ?? 0;

  if (needScore >= 2) return "adjust";
  return "reflect";
}

type Props = {
  rec: ConciergeRecommendation;
  index: number;
  needTags?: string[];
};

export default function RecommendationUnit({ rec, index, needTags = [] }: Props) {
  const safe: ConciergeRecommendation = {
    ...rec,
    name: (rec.name || rec.display_name || "（名称不明）").trim(),
  };

  const tone = pickTone(safe);
  const toneTexts = TONE_TEXT[tone];

  return (
    <div className="space-y-2">
      {index === 0 && needTags.length > 0 && <NeedChips tags={needTags} />}
      <ConciergeCard s={safe} index={index} toneTexts={index === 0 ? [...toneTexts] : undefined} showClose={false} />
    </div>
  );
}
