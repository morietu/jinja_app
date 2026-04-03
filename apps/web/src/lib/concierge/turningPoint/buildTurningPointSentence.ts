import type { TurningPointMeta } from "@/lib/concierge/turningPoint/types";

type Args = {
  turningPoint: TurningPointMeta;
};

export function buildTurningPointSentence(args: Args): string {
  const label = args.turningPoint.label;

  if (label === "停滞を切り替える節目") {
    return "今は流れを切り替える節目です。";
  }

  if (label === "方向を定める節目") {
    return "今は方向を定める節目です。";
  }

  if (label === "前に進む挑戦の節目") {
    return "今は前に進む節目です。";
  }

  if (label === "心身を整え直す節目") {
    return "今は心身を整え直す節目です。";
  }

  if (label === "優先順位を整える節目") {
    return "今は優先順位を整える節目です。";
  }

  return "今は新しい流れへ移る節目です。";
}
