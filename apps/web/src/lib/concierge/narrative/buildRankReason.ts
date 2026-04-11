import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { ConciergeMode, NeedTag } from "./types";

type BuildRankReasonArgs = {
  mode: ConciergeMode;
  breakdown?: ConciergeBreakdown | null;
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
};

export function buildRankReason(args: BuildRankReasonArgs): string {
  const total = args.breakdown?.score_total ?? null;
  const element = args.breakdown?.score_element ?? null;

  const primary = args.primaryNeed ?? null;
  const secondaryCount = Array.isArray(args.secondaryNeedTags)
    ? args.secondaryNeedTags.filter((tag) => tag && tag !== primary).length
    : 0;

  if (args.mode === "compat") {
    if (typeof element === "number" && element > 0) {
      return secondaryCount > 0
        ? "今回は生年月日との相性要素が強く、さらに他の相談軸とも比較したうえで上位に残った候補です。"
        : "今回は生年月日との相性要素が強く、相性軸で他候補より上位に残った候補です。";
    }

    return secondaryCount > 0
      ? "今回は相性軸を主に見つつ、他の候補と比較しても噛み合いが見られたため上位に入りました。"
      : "今回は相性軸で他候補より噛み合いが見られたため上位に入りました。";
  }

  if (args.primaryNeed === "courage") {
    return "今回は『前進』のテーマとの一致が強く、他候補と比べても行動のきっかけを持ちやすい候補として上位に入りました。";
  }

  if (args.primaryNeed === "mental") {
    return "今回は『気持ちを整える』テーマとの一致が強く、他候補と比べても今の状態に重ねて見やすい候補として上位に入りました。";
  }

  if (args.primaryNeed === "career") {
    return "今回は『仕事や転機』のテーマとの一致が強く、他候補と比べても判断の軸に置きやすい候補として上位に入りました。";
  }

  if (args.primaryNeed === "money") {
    return "今回は『金運や巡り』のテーマとの一致が強く、他候補と比べても流れの見直しと結びつけやすい候補として上位に入りました。";
  }

  if (args.primaryNeed === "rest") {
    return "今回は『休息』のテーマとの一致が強く、他候補と比べても無理に進まず整え直す文脈に近い候補として上位に入りました。";
  }

  if (args.primaryNeed === "love") {
    return "今回は『良縁や関係性』のテーマとの一致が強く、他候補と比べても関係性の整理と重ねて見やすい候補として上位に入りました。";
  }

  if (args.primaryNeed === "study") {
    return "今回は『学業や合格』のテーマとの一致が強く、他候補と比べても集中や姿勢の立て直しに結びつきやすい候補として上位に入りました。";
  }

  if (typeof total === "number") {
    return "今回は複数の観点を比較した総合評価で、他候補より上位に残った候補です。";
  }

  return "今回は相談軸との重なりを比較した結果、他候補より上位に残った候補です。";
}
