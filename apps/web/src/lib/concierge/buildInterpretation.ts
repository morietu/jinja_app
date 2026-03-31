// apps/web/src/lib/concierge/buildInterpretation.ts
import type { ShrineMeaningTone } from "./shrineMeaning";

export type ReasonNeedTag = "money" | "courage" | "career" | "mental" | "rest" | "love" | "study";

type Args = {
  primaryTag?: ReasonNeedTag | null;
  tone?: ShrineMeaningTone | null;
  rawReason?: string | null;
};

export function buildInterpretation(args: Args): string | null {
  const tone = args.tone ?? "neutral";
  const tag = args.primaryTag;

  if (tag === "money") {
    if (tone === "strong") return "金運の悩みは、流れが止まっている時ほど動きにくくなります。";
    if (tone === "quiet") return "焦りが強い時の金運は、まず巡りを整えることが先になります。";
    return "金運の悩みは、流れや巡りを立て直す視点が重要です。";
  }

  if (tag === "courage") {
    if (tone === "strong") return "迷いが長引くと、動く力そのものが鈍りやすくなります。";
    if (tone === "quiet") return "不安が強い時は、勢いよりも気持ちを整えてから動く方が合います。";
    if (tone === "tight") return "次の一歩を決めたい時ほど、迷いを絞って姿勢を定める必要があります。";
    return "次の一歩が重い時は、行動の意味を整理することが必要です。";
  }

  if (tag === "career") {
    return "仕事や転機の悩みは、焦って動くより判断軸を整えることが大切です。";
  }

  if (tag === "mental") {
    return "不安が続く時は、解決より先に気持ちを落ち着かせる場が必要になります。";
  }

  if (tag === "rest") {
    return "疲れが抜けない時は、前進より先に休める状態へ戻すことが重要です。";
  }

  if (tag === "love") {
    return "恋愛の悩みは、相手より先に自分の気持ちの整理が必要なことがあります。";
  }

  if (tag === "study") {
    return "集中したい時ほど、気持ちの散りや迷いを減らすことが先になります。";
  }

  return args.rawReason ?? null;
}
