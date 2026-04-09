import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SymbolTag } from "@/lib/concierge/narrative/symbolTags";

export type ConciergeMode = "need" | "compat";

export type NeedTag = "money" | "courage" | "career" | "mental" | "rest" | "love" | "study";

export type ShrineTone = "strong" | "quiet" | "tight" | "neutral";

export type ExplanationPrimaryReason = {
  type?: string | null;
  label?: string | null;
  label_ja?: string | null;
  evidence?: string[] | null;
  score?: number | null;
  is_primary?: boolean | null;
};

export type ExplanationPayload = {
  primary_need_tag?: string | null;
  primary_need_label_ja?: string | null;
  primary_reason?: ExplanationPrimaryReason | null;
  secondary_reasons?: ExplanationPrimaryReason[] | null;
  original_reason?: string | null;
  score?: {
    element?: number | null;
    need?: number | null;
    total?: number | null;
    total_ranked?: number | null;
  } | null;
};

export type NarrativeFallback = {
  interpretation?: string | null;
  consultationSummary?: string | null;
  shrineMeaning?: string | null;
  action?: string | null;
  short?: string | null;
  heroMeaningCopy?: string | null;
};

export type DeepReason = NarrativeFallback;

export type BuildNarrativeBaseArgs = {
  mode: ConciergeMode;
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
  shrineTone?: ShrineTone;
  shrineName?: string | null;
  benefitLabels?: string[];
  primaryReasonLabel?: string | null;
  userElementLabel?: string | null;
  breakdown?: ConciergeBreakdown | null;
  explanationPayload?: ExplanationPayload | null;
  deepReason?: NarrativeFallback | null;
  conciergeReason?: string | null;
  shrineSymbolTags?: SymbolTag[] | null;
};

export type RecommendationNarrative = {
  mode: ConciergeMode;
  primaryNeed: NeedTag | null;
  secondaryNeeds: NeedTag[];
  shrineTone: ShrineTone;
  breakdown: ConciergeBreakdown | null;
  psychologicalTags: string[];
  symbolTags: string[];
  turningPoint: {
    type: string;
    label: string;
    shortLabel: string;
    sentence: string | null;
  };
  meaning: {
    short: string | null;
    lead: string | null;
    consultationSummary: string | null;
  };
  match: {
    userState: string | null;
    shrineBenefit: string | null;
    actionMeaning: string | null;
  };
  ranking: {
    rankReason: string | null;
    comparisonText: string | null;
  };
  shrine: {
    shrineMeaning: string | null;
  };
};
