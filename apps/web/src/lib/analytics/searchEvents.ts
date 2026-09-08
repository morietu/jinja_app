import { getAnalyticsProvider } from "@/lib/analytics/providers";

export type SearchAnalyticsEventName =
  | "shrine_search"
  | "map_search"
  | "route_open"
  | "visit_done"
  | "reflection_prompt_view"
  | "reflection_saved"
  | "shrine_detail_transition"
  | "concierge_result_impression"
  | "recommendation_quality"
  | "action_suggestion_view"
  | "action_suggestion_click"
  | "action_suggestion_reflection_preview_view"
  | "action_started"
  | "action_completed"
  | "action_done"
  | "action_suggestion_preview_view"
  | "primary_action_click"
  | "secondary_action_click"
  | "empty_state_view"
  | "add_shrine_click"
  | "shrine_card_click"
  | "shrine_detail_view"
  | "nearby_fetch"
  // Compass lifecycle (docs/audit/compass-analytics-contract-readiness.md
  // §6-7, PR-A scope only -- discovery/entry/result, no downstream
  // Recommendation/Shrine-Detail/Favorite/Visit/Reflection attribution).
  | "home_compass_entry_click"
  | "compass_entry"
  | "compass_result";

type SearchAnalyticsPrimitive = string | number | boolean | null | undefined;

export type SearchAnalyticsPayload = {
  source?: "concierge_result" | "compass" | "shrine_detail" | "map" | "shrines" | "home" | null;
  analyticsSessionId?: string | null;
  threadId?: string | null;
  resultSetId?: string | null;
  shrineId?: number | string | null;
  recommendationRank?: number | null;
  /**
   * 遷移元URLの `ctx` クエリパラメータから導出する（`ctx === "concierge"` の場合 `"need"`）。
   * `ctx` の値自体をpayloadへ直接送信しない。
   */
  mode?: "need" | "compat" | null;
  accessLevel?: "anonymous" | "free" | "premium" | null;
  shrine_data_rate?: number | null;
  consultation_reflection_rate?: number | null;
  fallback_reason_rate?: number | null;
  evidence_rate?: number | null;
  action_grounding_rate?: number | null;
  is_ai_inference_only?: boolean | null;
  fallback_source?: string | null;
  primaryReasonSource?: string | null;
  isFallbackRecommendation?: boolean | null;
  actionSource?: string | null;
  actionSourceKeys?: string | null;
  recommendationInstanceId?: string | null;
  position?: "hero_primary" | "compact" | "map" | "list" | null;
  firstClick?: boolean | null;
  query?: string | null;
  routeTarget?: "google_maps" | "internal_map" | null;
  historyTheme?: string | null;
  consultationAxis?: string | null;
  actionTheme?: string | null;
  /** Nearby fetch only. Fixed product surface; never a URL, coordinate, or free text. */
  surface?: "web" | null;
  /** Nearby fetch only. Distinguishes automatic fetches from the explicit refresh button. */
  trigger?: "auto" | "manual_refresh" | null;
  /** Nearby fetch only. Coarse fallback flag; coordinates are never included in analytics. */
  used_fallback?: boolean | null;
  /**
   * 実際のReflection入力UI（reflection_prompt_view / reflection_saved）でのみ使用する。
   * どのフォーム構造で入力させたかを表す。
   */
  reflectionFormType?: "one_line" | "mood_delta" | "theme_reflection" | null;
  /**
   * 実際のReflection入力UI（reflection_prompt_view / reflection_saved）でのみ使用する。
   * Reflectionがどの文脈で表示されたかを表す。
   */
  reflectionContext?: "visit_done" | "mypage" | "night_reflection" | null;
  /**
   * Action Suggestion v4のreflection_prompt.prompt_typeをそのまま転記する。
   * action_suggestion_preview_view / action_suggestion_reflection_preview_viewでのみ使用する。
   */
  actionPromptType?: "before_visit" | "after_visit" | "decision" | "emotion" | "constraint" | null;
  answerLength?: number | null;
  moodBefore?: string | null;
  moodAfter?: string | null;
  /**
   * Compass lifecycle only (compass_entry). "home" when reached via the
   * Home Compass entry (`/compass?ref=home`), "direct" otherwise. Distinct
   * from `source` above, which is reserved for Recommendation/Shrine-Detail
   * provenance (PR-B/PR-C scope) and must not be overloaded here.
   */
  referrer_source?: "home" | "direct" | null;
  /**
   * Compass lifecycle only (compass_result). Mirrors
   * temples.services.compass_recommendation_orchestrator's real state
   * strings exactly, plus the frontend-only "backend_error" bucket used for
   * network failures and non-400 error responses. Never collapsed --
   * docs/audit/compass-analytics-contract-readiness.md §10.
   */
  result_state?:
    | "invalid_purpose"
    | "direction_filter_unavailable"
    | "no_common_direction"
    | "recommendation_eligibility_zero_candidates"
    | "direction_zero_candidates"
    | "evidence_zero_candidates"
    | "recommendation_success"
    | "backend_error"
    | null;
  /** Compass lifecycle only. Canonical CompassPurpose slug, never free text. */
  purpose?: string | null;
  /**
   * Compass lifecycle only. Coarse origin category (UserOrigin.source),
   * never coordinates/address/station text.
   */
  origin_mode?: "device" | "station" | "address" | "prefecture" | null;
  /** Compass lifecycle only. Boolean readiness signal, never the birthdate value itself. */
  has_birthdate?: boolean | null;
  /** Compass lifecycle only (compass_result, recommendation_success). */
  recommendation_count?: number | null;
  /**
   * Compass lifecycle only (compass_result). Segmentation dimension only --
   * distinguishes a COMMON direction (annual∩monthly agreement) from a
   * MONTHLY FALLBACK direction (monthly-only guidance, no annual
   * corroboration); see docs/product/compass-product-contract.md Section 2.2
   * and docs/product/compass-mvp-runtime-contract.md Section 5-1 (#2508
   * Option C). Mirrors the backend/Runtime Contract value verbatim -- never
   * renamed to "COMMON"/"FALLBACK" here. `null` (not fabricated) whenever
   * the result carries no direction_context (e.g. no_common_direction,
   * direction_filter_unavailable, backend_error) -- absence of a direction
   * is not itself a calculation method.
   */
  calculationMethod?: "annual_monthly_kyusei_v1" | "monthly_kyusei_v1" | null;
  /**
   * Compass lifecycle only (compass_result). Compass Geographic Distance
   * Boundary metadata, mirrored verbatim from the backend orchestrator's
   * CompassRecommendationResult -- never recomputed on the frontend. null
   * whenever the result carries no direction_context (same absence rule as
   * calculationMethod above).
   */
  distance_stage_km?: 15 | 30 | 60 | null;
  /** Compass lifecycle only (compass_result). Candidate count immediately after Direction Filter, before the distance stage. */
  direction_candidate_count?: number | null;
  /** Compass lifecycle only (compass_result). Candidate count within the adopted distance_stage_km ring. */
  distance_candidate_count?: number | null;
  [key: string]: SearchAnalyticsPrimitive;
};

export type SerializedSearchAnalyticsPayload = Record<string, string | number | boolean>;

function isSearchAnalyticsPrimitive(value: unknown): value is SearchAnalyticsPrimitive {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  );
}

export function serializeSearchAnalyticsPayload(
  payload: SearchAnalyticsPayload = {},
): SerializedSearchAnalyticsPayload {
  const serialized: SerializedSearchAnalyticsPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    if (!isSearchAnalyticsPrimitive(value)) continue;

    serialized[key] = value;
  }

  return serialized;
}

export function trackSearchEvent(eventName: SearchAnalyticsEventName, payload: SearchAnalyticsPayload = {}) {
  const serializedPayload = serializeSearchAnalyticsPayload(payload);

  try {
    getAnalyticsProvider().track(eventName, serializedPayload);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[search analytics]", eventName, serializedPayload, error);
    }
  }
}

export type NearbyFetchAnalyticsPayload = {
  source: "map";
  surface: "web";
  trigger: "auto" | "manual_refresh";
  used_fallback: boolean;
};

export function trackNearbyFetch(payload: NearbyFetchAnalyticsPayload) {
  trackSearchEvent("nearby_fetch", payload);
}

export type RecommendationQualityAnalyticsPayload = {
  source: "concierge_result" | "shrine_detail";
  threadId?: string | null;
  shrineId?: number | string | null;
  recommendationRank?: number | null;
  resultSetId?: string | null;
  accessLevel?: "anonymous" | "free" | "premium" | null;
  shrine_data_rate?: number | null;
  consultation_reflection_rate?: number | null;
  fallback_reason_rate?: number | null;
  evidence_rate?: number | null;
  action_grounding_rate?: number | null;
  is_ai_inference_only?: boolean | null;
  fallback_source?: string | null;
  primaryReasonSource?: string | null;
  isFallbackRecommendation?: boolean | null;
  actionSource?: string | null;
  actionSourceKeys?: string | null;
  recommendationInstanceId?: string | null;
  // docs/audit/knowledge-recommendation-analytics-contract.md 提案の最小Contract。
  // Backend recommendation_reason_quality（PR2382のbuild_shrine_reason_provenance()を
  // 再利用して算出）から受け取るのみで、Web側では再計算しない。
  knowledge_backing_class?:
    | "FULLY_KNOWLEDGE_BACKED"
    | "PARTIALLY_KNOWLEDGE_BACKED"
    | "LEGACY_BACKED"
    | "UNKNOWN"
    | null;
  deity_knowledge_used?: boolean | null;
  history_knowledge_used?: boolean | null;
};

export function trackRecommendationQuality(payload: RecommendationQualityAnalyticsPayload) {
  trackSearchEvent("recommendation_quality", payload);
}
