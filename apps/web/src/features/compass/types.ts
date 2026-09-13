// Compass MVP UI types.
//
// Mirrors docs/product/compass-mvp-runtime-contract.md Section 5
// (CompassDirectionRuntime) and the response shape of
// backend/temples/api_views_compass.py::CompassRecommendationsView, which
// wraps temples.services.compass_recommendation_orchestrator's 6 result
// states (see that module's docstring). Kept local to the Compass feature
// rather than packages/shared -- no other app consumes it yet.
//
// "no_common_direction" is a VALID result (Runtime Contract Section 8
// Group B), never collapsed into "direction_filter_unavailable" (Group A --
// genuinely invalid/unavailable runtime). See compass-product-contract.md
// Section 2.1.

import type { Shrine } from "@/lib/api/shrines";

export type CompassPurpose =
  | "love"
  | "relationship"
  | "marriage"
  | "communication"
  | "career"
  | "money"
  | "study"
  | "health"
  | "mental"
  | "protection"
  | "courage"
  | "focus"
  | "rest"
  | "family"
  | "travel_safe";

export type CompassDirectionRuntime = {
  targetDate: string;
  targetYear: number;
  solarMonthIndex: number;
  referenceDirections: string[];
  // "monthly_kyusei_v1" = Monthly Fallback (Product Contract Section 2.2 /
  // Runtime Contract Section 5-1, #2508 Option C): referenceDirections come
  // from monthly-only guidance, not annual/monthly agreement. Type-only
  // widening -- no fallback-specific UI/copy is implemented by this change.
  calculationMethod: "annual_monthly_kyusei_v1" | "monthly_kyusei_v1";
  note: string;
};

// Every state the backend orchestrator can return, plus the frontend-only
// states that never reach the network (birthdate/origin missing before
// submit) and the two states no server response maps to (initial/loading).
// Never collapsed into each other -- see Section 13 of the Phase 5 brief:
// "Do not collapse: direction unavailable and zero candidates into the
// same UX state."
export type CompassUiState =
  | "initial"
  | "birthdate_missing"
  | "origin_missing"
  | "origin_permission_denied"
  | "loading"
  | "invalid_purpose"
  | "direction_filter_unavailable"
  | "no_common_direction"
  | "recommendation_eligibility_zero_candidates"
  | "direction_zero_candidates"
  | "evidence_zero_candidates"
  | "recommendation_success"
  | "backend_error";

// Already present on the raw recommendation dict Compass's response returns
// today (backend/temples/api_views_compass.py has no serializer -- the dict
// build_chat_recommendations() produces is spread into the response as-is).
// Only the two fields this PR's Explanation actually reads are typed here;
// everything else on the dict is still covered by the index signature below.
export type CompassReasonFact = {
  type?: string | null;
  label?: string | null;
  label_ja?: string | null;
  is_primary?: boolean | null;
};

export type CompassRecommendationBreakdown = {
  matched_need_tags?: string[] | null;
};

export type CompassRecommendation = {
  shrine_id?: number | string | null;
  id?: number | string | null;
  name?: string | null;
  address?: string | null;
  distance_m?: number | null;
  reason?: string | null;
  place_id?: string | null;
  recommendation_instance_id?: string | null;
  breakdown?: CompassRecommendationBreakdown | null;
  reason_facts?: CompassReasonFact[] | null;
  [key: string]: unknown;
};

export type CompassRecommendationsResponse = {
  state:
    | "invalid_purpose"
    | "direction_filter_unavailable"
    | "no_common_direction"
    | "recommendation_eligibility_zero_candidates"
    | "direction_zero_candidates"
    | "evidence_zero_candidates"
    | "recommendation_success";
  purpose: string | null;
  direction_context: CompassDirectionRuntime | null;
  recommendation_instance_id: string;
  recommendations: CompassRecommendation[];
  // Compass Geographic Distance Boundary metadata (backend orchestrator is
  // the source of truth -- never recomputed here). null for every fail-safe
  // state that never reaches the distance stage (invalid_purpose,
  // direction_filter_unavailable, no_common_direction); see
  // temples.services.compass_recommendation_orchestrator.
  distance_stage_km: 15 | 30 | 60 | null;
  direction_candidate_count: number | null;
  distance_candidate_count: number | null;
};

// ---------------------------------------------------------------------------
// Weekly Compass (PR3 Web接続)
//
// backend/temples/api_views_compass_weekly.py::CompassWeeklyView の
// response shapeをそのまま写したもの。stateはBackendが実際に返す値だけを
// 列挙する（推測したstateを足さない）:
//   - "weekly_success"（Weekly固有の成功state）
//   - Snapshot MISS時にRecommendationが非成功だった場合の既存Compass state
//     （CompassRecommendationsResponse["state"] と同一集合のうち、
//       recommendation_success を除いたもの）
//
// Weekly ThemeはBackendのPresentation Copyであり、Frontendで生成も書き換えも
// しない。featured_shrinesはBackendが最大3件を保証するため、Frontendでslice・
// 再ranking・不足分の補充を行わない。
// ---------------------------------------------------------------------------

export type CompassWeeklyTheme = {
  key: string;
  title: string;
  message: string;
};

export type CompassWeeklyState =
  | "weekly_success"
  | "invalid_purpose"
  | "direction_filter_unavailable"
  | "no_common_direction"
  | "recommendation_eligibility_zero_candidates"
  | "direction_zero_candidates"
  | "evidence_zero_candidates";

export type CompassWeeklyResponse = {
  state: CompassWeeklyState;
  purpose: string | null;
  // Backend Time Contract（Asia/Tokyo / Monday start）が決めた表示用の週境界。
  // Frontendで週を計算し直さない。
  week: {
    start: string;
    end: string;
  };
  direction_context: CompassDirectionRuntime | null;
  // 非成功stateではnull。Snapshot HIT時は保存済みのThemeがそのまま返る。
  weekly_theme: CompassWeeklyTheme | null;
  // 既存 ShrineListSerializer の公開表現。Weekly専用のShrine型は作らない。
  // Snapshot保存後に表示不可となったShrineは除外されるため、成功時でも
  // 0〜3件になり得る（Frontendで別の神社を補充しない）。
  featured_shrines: Shrine[];
  presentation_version: string;
};
