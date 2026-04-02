import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { PsychologicalTag } from "@/lib/concierge/narrative/psychologicalTags";
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

export type DeepReason = {
  interpretation: string | null;
  shrineMeaning: string | null;
  action: string | null;
  short: string | null;
};

export type RecommendationMeaning = {
  short: string | null;
  lead: string | null;
};

export type RecommendationMatch = {
  userState: string | null;
  shrineBenefit: string | null;
  actionMeaning: string | null;
};

export type RecommendationRanking = {
  rankReason: string | null;
  comparisonText: string | null;
};

export type RecommendationShrine = {
  shrineMeaning: string | null;
};

export type RecommendationNarrative = {
  mode: ConciergeMode;
  primaryNeed: NeedTag | null;
  secondaryNeeds: NeedTag[];
  shrineTone: ShrineTone;
  breakdown?: ConciergeBreakdown | null;
  psychologicalTags: PsychologicalTag[];
  symbolTags: SymbolTag[];
  meaning: RecommendationMeaning;
  match: RecommendationMatch;
  ranking: RecommendationRanking;
  shrine: RecommendationShrine;
};

export type BuildNarrativeBaseArgs = {
  mode: ConciergeMode;
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
  shrineName?: string | null;
  shrineTone?: ShrineTone;
  breakdown?: ConciergeBreakdown | null;
  explanationPayload?: ExplanationPayload | null;
  deepReason?: DeepReason | null;
  conciergeReason?: string | null;
  benefitLabels?: string[];
  userElementLabel?: string | null;
  primaryReasonLabel?: string | null;
  shrineSymbolTags?: SymbolTag[] | null;
};
