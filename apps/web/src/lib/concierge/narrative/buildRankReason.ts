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

  if (args.mode === "compat") {
    if (typeof element === "number" && element > 0) {
      return "今回は生年月日との相性要素が強く、相性軸で上位に入りました。";
    }

    return "今回は相性軸を主に見たときに、他候補より噛み合いが見られました。";
  }

  if (args.primaryNeed === "courage") {
    return "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。";
  }

  if (args.primaryNeed === "mental") {
    return "今回は「気持ちを整える」テーマとの一致が強く、他候補より落ち着きを取り戻す参拝先として位置づけやすいため上位に入りました。";
  }

  if (args.primaryNeed === "career") {
    return "今回は「仕事や転機」のテーマとの一致が強く、他候補より判断を整理する節目として置きやすいため上位に入りました。";
  }

  if (args.primaryNeed === "money") {
    return "今回は「金運や巡り」のテーマとの一致が強く、他候補より流れを立て直す節目として置きやすいため上位に入りました。";
  }

  if (args.primaryNeed === "rest") {
    return "今回は「休息」のテーマとの一致が強く、他候補より無理に進まず立て直す参拝先として位置づけやすいため上位に入りました。";
  }

  if (args.primaryNeed === "love") {
    return "今回は「良縁や関係性」のテーマとの一致が強く、他候補より気持ちを整えながら向き合いやすい候補として上位に入りました。";
  }

  if (args.primaryNeed === "study") {
    return "今回は「学業や合格」のテーマとの一致が強く、他候補より集中や姿勢を立て直す参拝先として置きやすいため上位に入りました。";
  }

  if (typeof total === "number") {
    return "今回は複数の観点を合わせた総合評価で上位に入りました。";
  }

  return "今回は今回の相談軸に近い候補として上位に入りました。";
}
