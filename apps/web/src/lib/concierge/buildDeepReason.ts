// apps/web/src/lib/concierge/buildDeepReason.ts
import { findShrineMeaning } from "./findShrineMeaning";
import { buildInterpretation, type ReasonNeedTag } from "./buildInterpretation";

export type DeepReason = {
  interpretation: string | null;
  shrineMeaning: string | null;
  action: string | null;
  short: string | null;
};

type ShrineTone = "strong" | "quiet" | "tight" | "neutral";

type Args = {
  shrineName?: string | null;
  primaryTag?: ReasonNeedTag | null;
  rawReason?: string | null;
  fallbackShort?: string | null;
  shrineTone?: ShrineTone | null;
};

export function buildDeepReason(args: Args): DeepReason {
  const found = findShrineMeaning(args.shrineName);
  const tone = found?.tone ?? args.shrineTone ?? "neutral";

  const interpretation = buildInterpretation({
    primaryTag: args.primaryTag,
    tone,
    rawReason: args.rawReason,
  });

  const short = args.fallbackShort ?? args.rawReason ?? null;

  return {
    interpretation,
    shrineMeaning: found?.meaningSentence ?? null,
    action: found?.actionSentence ?? short ?? null,
    short,
  };
}
