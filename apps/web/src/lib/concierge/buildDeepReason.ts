// apps/web/src/lib/concierge/buildDeepReason.ts
import { sanitizeCopyText, normalizeCopyText } from "@/lib/concierge/conciergeCopyRules";
import type { NarrativeFallback } from "@/lib/concierge/narrative/types";
import { findShrineMeaning } from "./findShrineMeaning";
import { buildInterpretation, type ReasonNeedTag } from "./buildInterpretation";

export type DeepReason = NarrativeFallback;

type ShrineTone = "strong" | "quiet" | "tight" | "neutral";

type Args = {
  shrineName?: string | null;
  primaryTag?: ReasonNeedTag | null;
  rawReason?: string | null;
  fallbackShort?: string | null;
  shrineTone?: ShrineTone | null;
};

export function buildDeepReason(args: Args): NarrativeFallback {
  const found = findShrineMeaning(args.shrineName);
  const tone = found?.tone ?? args.shrineTone ?? "neutral";

  const interpretation = buildInterpretation({
    primaryTag: args.primaryTag,
    tone,
    rawReason: args.rawReason,
  });

  const short = args.fallbackShort ?? args.rawReason ?? null;

  return {
    interpretation: sanitizeCopyText(interpretation),
    shrineMeaning: sanitizeCopyText(found?.meaningSentence ?? null),
    action: sanitizeCopyText(found?.actionSentence ?? short ?? null),
    short: normalizeCopyText(short),
  };
}
