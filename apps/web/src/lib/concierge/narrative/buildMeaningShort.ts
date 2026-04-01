import type { NeedTag, ShrineTone } from "@/lib/concierge/narrative/types";

type BuildMeaningShortArgs = {
  shrineName?: string | null;
  primaryNeed?: NeedTag | null;
  shrineTone?: ShrineTone;
  fallbackText?: string | null;
};

export function buildMeaningShort(args: BuildMeaningShortArgs): string | null {
  const primaryNeed = args.primaryNeed ?? null;
  const shrineTone = args.shrineTone ?? "neutral";
  const fallbackText = args.fallbackText?.trim() || null;

  if (!primaryNeed) return fallbackText;

  if (primaryNeed === "courage") {
    if (shrineTone === "strong") return "流れを切り替えたい時に";
    if (shrineTone === "tight") return "次の一歩を決めたい時に";
    if (shrineTone === "quiet") return "気持ちを整えて決めたい時に";
    return "前に進むきっかけがほしい時に";
  }

  if (primaryNeed === "mental") {
    if (shrineTone === "strong") return "気持ちを切り替えたい時に";
    if (shrineTone === "tight") return "気持ちを立て直したい時に";
    return "不安や気持ちを整えたい時に";
  }

  if (primaryNeed === "career") {
    if (shrineTone === "strong") return "仕事の停滞を動かしたい時に";
    if (shrineTone === "tight") return "仕事や転機の判断を定めたい時に";
    return "仕事や転機を整理したい時に";
  }

  if (primaryNeed === "money") {
    if (shrineTone === "strong") return "流れを立て直したい時に";
    if (shrineTone === "quiet") return "巡りを整えたい時に";
    return "金運や流れを整えたい時に";
  }

  if (primaryNeed === "rest") {
    if (shrineTone === "quiet") return "静かに休みたい時に";
    return "心身を整え直したい時に";
  }

  if (primaryNeed === "love") {
    if (shrineTone === "quiet") return "関係性を見直したい時に";
    return "良縁や関係性に向き合いたい時に";
  }

  if (primaryNeed === "study") {
    if (shrineTone === "tight") return "集中や目標を定めたい時に";
    return "集中を整え直したい時に";
  }

  return fallbackText;
}
