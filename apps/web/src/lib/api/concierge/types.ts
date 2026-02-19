// apps/web/src/lib/api/concierge/types.ts

export type ConciergeThread = {
  id: number;
  title: string;
  last_message: string;
  last_message_at: string | null;
  message_count: number;
};

export type ConciergeMessage = {
  id: number;
  thread_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type ConciergeRecommendation = {
  id?: number | null;
  place_id?: string | null;

  name: string;
  display_name?: string;

  address?: string | null;
  display_address?: string | null;

  location?:
    | string
    | null
    | {
        lat: number;
        lng: number;
      };

  lat?: number | null;
  lng?: number | null;

  distance_m?: number | null;
  duration_min?: number | null;
  score?: number | null;
  popular_score?: number | null;
  breakdown?: ConciergeBreakdown | null;

  tags?: string[];
  deities?: string[];

  reason: string;

  photo_url?: string | null;
  is_dummy?: boolean;
  __dummy?: boolean;
};

export type ConciergeChatRequest = {
  query: string;
  thread_id?: number | string | null;
};

export type ConciergeChatData = {
  recommendations?: ConciergeRecommendation[];
  raw?: string;
  reply?: string;

  _need?: ConciergeNeed;
  _astro?: any; // まずは緩めでOK（後で型にする）
};

export type ConciergeChatResponse = {
  ok: boolean;
  data?: ConciergeChatData;
  reply?: string;
  note?: string;
  thread?: ConciergeThread;

  // ★ backendが返してきたら表示できるように「任意」で受ける
  remaining_free?: number;
  limit?: number;
};

export type ConciergeThreadDetail = {
  thread: ConciergeThread;
  messages: ConciergeMessage[];
  recommendations?: ConciergeRecommendation[];
};

export type ConciergeNeed = {
  tags?: string[];
  hits?: Record<string, string[]>;
};

export type ConciergeBreakdown = {
  score_element: number; // 0/1/2
  score_need: number;
  score_popular: number; // 0..1
  score_total: number;
  weights: {
    element: number;
    need: number;
    popular: number;
  };
  matched_need_tags: string[];
};
