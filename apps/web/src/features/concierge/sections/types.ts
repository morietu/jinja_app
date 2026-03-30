//apps / web / src / features / concierge / sections / types.ts;

import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { ConciergeModeSignal } from "@/features/concierge/types/unified";

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
  extraCondition: string;
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
  isDummy?: boolean;

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
  | { type: "open_map" }
  | { type: "add_condition" }
  | { type: "filter_close" }
  | { type: "filter_apply" }
  | { type: "filter_set_birthdate"; birthdate: string }
  | { type: "filter_toggle_tag"; tagId: number }
  | { type: "filter_set_extra"; extraCondition: string }
  | { type: "filter_clear" };
