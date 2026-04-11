// apps/web/src/features/concierge/types/chatRequest.ts
export type ConciergeChatFilters = {
  // ===== 互換（既存backendが読む想定） =====
  birthdate?: string; // "YYYY-MM-DD"
  goriyaku_tag_ids?: number[]; // [1,2,3]
  extra_condition?: string; // "駅近 ひとり"

  // ===== 新（UI/推薦ロジック用：機械可読） =====
  area_pref?: string[]; // ["東京都"]
  goriyaku?: string[]; // ["縁結び","厄除け"]
  crowd?: ("quiet" | "normal" | "crowded")[];
  duration_max_min?: number;
  free_text?: string; // extra_condition を最終的にここに寄せる
};

export type ConciergeMode = "need" | "compat";

export type ConciergeChatRequestV1 = {
  version: 1;
  query: string;
  mode?: ConciergeMode;
  thread_id?: string;
  filters?: ConciergeChatFilters;
  birthdate?: string;
  goriyaku_tag_ids?: number[];
  extra_condition?: string;
};
