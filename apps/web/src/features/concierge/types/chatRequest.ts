// apps/web/src/features/concierge/types/chatRequest.ts
export type ConciergeMode = "need" | "compat";

export type ConciergeChatFilters = {
  birthdate?: string;
  goriyaku_tag_ids?: number[];
  extra_condition?: string;
  area_pref?: string[];
  goriyaku?: string[];
  crowd?: ("quiet" | "normal" | "crowded")[];
  duration_max_min?: number;
  free_text?: string;
};

export type ConciergeChatRequestV1 = {
  version: 1;
  query: string;
  thread_id?: string;
  mode?: ConciergeMode;
  flow?: "A" | "B";
  filters?: ConciergeChatFilters;
};
