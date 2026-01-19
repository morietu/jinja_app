// apps/web/src/features/concierge/types/chatRequest.ts

export type ConciergeChatFilters = {
  goriyaku_tag_ids?: number[];
  birthdate?: string; // "YYYY-MM-DD"
  extra_condition?: string;
};

export type ConciergeChatRequestV1 = {
  version: 1;
  query: string;
  thread_id?: string;
  filters?: ConciergeChatFilters;
};
