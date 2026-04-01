import type { ConciergeMode, NeedTag, ShrineTone } from "./types";

type BuildComparisonTextArgs = {
  mode: ConciergeMode;
  primaryNeed?: NeedTag | null;
  shrineName?: string | null;
  shrineTone?: ShrineTone;
};

export function buildComparisonText(args: BuildComparisonTextArgs): string {
  const shrineText = args.shrineName?.trim() || "この神社";

  if (args.mode === "compat") {
    return `${shrineText}は、今回の候補の中でも相性軸との噛み合いが強い候補です。`;
  }

  if (args.primaryNeed === "courage") {
    return `${shrineText}は、今回の候補の中でも行動のきっかけを持ちやすい候補です。`;
  }

  if (args.primaryNeed === "mental") {
    return `${shrineText}は、今回の候補の中でも気持ちを落ち着ける方向に最も寄った候補です。`;
  }

  if (args.primaryNeed === "career") {
    return `${shrineText}は、今回の候補の中でも仕事や転機の判断を整理しやすい候補です。`;
  }

  if (args.primaryNeed === "money") {
    return `${shrineText}は、今回の候補の中でも巡りや流れを立て直す意味を持たせやすい候補です。`;
  }

  if (args.primaryNeed === "rest") {
    return `${shrineText}は、今回の候補の中でも無理に進まず休息を置きやすい候補です。`;
  }

  if (args.primaryNeed === "love") {
    return `${shrineText}は、今回の候補の中でも良縁や関係性に丁寧に向き合いやすい候補です。`;
  }

  if (args.primaryNeed === "study") {
    return `${shrineText}は、今回の候補の中でも集中や姿勢を立て直しやすい候補です。`;
  }

  return `${shrineText}は、今回の候補の中でも相談軸に近い候補です。`;
}
