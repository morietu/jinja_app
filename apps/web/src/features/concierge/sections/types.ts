import type { ConciergeBreakdown, ConciergeReasonFacts } from "@/lib/api/concierge";
import type { ConciergeModeSignal } from "@/features/concierge/types/unified";
import type { DirectionReference } from "../../../../../../packages/shared/directionReference";
import type { RecommendationAnalyticsProvenance } from "../../../../../../packages/shared/recommendationAnalyticsProvenance";
import type { UserOrigin } from "../../../../../../packages/shared/userOrigin";

/* =========================
 * filter state
 * ========================= */
export type Element4 = "火" | "地" | "風" | "水";
export type GoriyakuTag = { id: number; name: string };

export type ConciergeFilterState = {
  isOpen: boolean;
  birthdate: string; // YYYY-MM-DD（空文字OK）
  element4: Element4 | null;
  goriyakuTags: readonly GoriyakuTag[];
  suggestedTags: readonly GoriyakuTag[];
  selectedTagIds: readonly number[];
  tagsLoading: boolean;
  tagsError: string | null;
  extraCondition: string; // Level 2 Visit Preference (Legacy/Transitional, free-text)
  visitPreferences: readonly string[]; // Level 2 Visit Preference (Structured, canonical tags)
  // Level 3-C Recommendation Context. These remain optional during the staged
  // PR3 wiring so the branch stays type-safe until ConciergeClientFull starts
  // projecting the existing source-of-truth state into this FilterState.
  plannedVisitDate?: string;
  userOrigin?: UserOrigin | null;
};

/* =========================
 * recommendation items
 * ========================= */
export type RegisteredShrineItem = {
  kind: "registered";
  shrineId: number;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
  detailHref?: string;
  breakdown?: ConciergeBreakdown | null;
  breakdown_detail?: any | null;
  reasonFacts?: ConciergeReasonFacts | null;
  analyticsProvenance?: RecommendationAnalyticsProvenance;
  /** Backend rid, reused as-is (docs/audit/recommendation-instance-identity-propagation.md). Never generated on Frontend. */
  recommendationInstanceId?: string | null;
  consultationAxis?: string | null;
  explanation?: {
    version?: number | null;
    summary?: string | null;
    reasons?: Array<{
      code?: string | null;
      label?: string | null;
      text?: string | null;
      strength?: "low" | "mid" | "high" | null;
      evidence?: Record<string, unknown> | null;
    }> | null;
    disclaimer?: string | null;
  } | null;
  directionReference?: DirectionReference | null;
};

export type PlaceShrineItem = {
  kind: "place";
  placeId: string;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
  detailHref?: string;
  detailLabel?: string;
  breakdown?: ConciergeBreakdown | null;
  breakdown_detail?: any | null;
  reasonFacts?: ConciergeReasonFacts | null;
  analyticsProvenance?: RecommendationAnalyticsProvenance;
  /** Backend rid, reused as-is (docs/audit/recommendation-instance-identity-propagation.md). Never generated on Frontend. */
  recommendationInstanceId?: string | null;
  consultationAxis?: string | null;
  isDummy?: boolean;
  directionReference?: DirectionReference | null;
};

/* =========================
 * sections
 * ========================= */
export type GuideSection = {
  type: "guide";
  text: string;
};

export type FilterSection = {
  type: "filter";
  title?: string;
  closedLabel?: string;
  state: ConciergeFilterState;
};

export type RecommendationsSection = {
  type: "recommendations";
  title?: string;
  items: readonly (RegisteredShrineItem | PlaceShrineItem)[];
};

export type ActionType = "add_condition" | "open_map";

export type ActionsSection = {
  type: "actions";
  items: readonly {
    action: ActionType;
    label: string;
  }[];
};

export type AstroSection = {
  type: "astro";
  title?: string;
  sunSign?: string;
  element?: string;
  elementCode?: string;
  reason?: string;
};

/* =========================
 * union / payload
 * ========================= */
export type ConciergeSection = GuideSection | FilterSection | RecommendationsSection | ActionsSection | AstroSection;

export type ConciergeSectionsPayload = {
  version: 1;
  sections: readonly ConciergeSection[];
  meta?: {
    mode?: ConciergeModeSignal | null;
    reply?: string | null;
    remaining?: number | null;
    limitReached?: boolean;
    tid?: string | null;
    consultationAxis?: string | null;
    /** ユーザー相談由来の入力側need_tags。`breakdown.matched_need_tags`（一致結果）とは責務が異なる */
    needTags?: string[];
    resultState?: {
      matched_count?: number;
      fallback_mode?: "none" | "nearby_unfiltered" | string;
      fallback_reason_ja?: string | null;
      ui_disclaimer_ja?: string | null;
      requested_extra_condition?: string | null;
    } | null;
  };
};

/* =========================
 * renderer -> client action
 * ========================= */
export type RendererAction =
  | { type: "back_to_entry" }
  | { type: "open_map"; shrineId?: number | null; rank?: number | null; routeHref?: string | null }
  | { type: "add_condition" }
  | { type: "filter_close" }
  | { type: "filter_apply" }
  | { type: "filter_set_birthdate"; birthdate: string }
  | { type: "filter_toggle_tag"; tagId: number }
  | { type: "filter_set_extra"; extraCondition: string }
  | { type: "filter_set_visit_preferences"; visitPreferences: string[] }
  | { type: "filter_clear" }
  | { type: "save_concierge_thread" };
