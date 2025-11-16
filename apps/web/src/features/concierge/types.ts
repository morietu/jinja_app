// src/features/concierge/types.ts

// クライアントから送る payload
export type ConciergeChatRequest = {
  message?: string; // 新UIは基本こっち
  query?: string; // 既存互換
  lat?: number;
  lng?: number;
  candidates?: Array<{
    formatted_address?: string;
    place_id?: string;
    name?: string;
    // バックエンド追加用の拡張フィールドはここに足していく
    [key: string]: unknown;
  }>;
};

// 将来の本番LLMも見据えたレスポンス data
export type ConciergeChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string; // ISO文字列
};

export type ConciergeChatData = {
  // 今は raw プレースホルダだが、後で JSON になっても互換にしやすいように確保
  raw: string;
  messages?: ConciergeChatMessage[];
};

export type ConciergeChatSuccessResponse = {
  ok: true;
  data: ConciergeChatData;
  note?: string;
  reply?: string; // 現状の echo 用。UIはこれを優先的に使ってもOK
};

export type ConciergeErrorResponse = {
  detail: string;
  reply?: string;
};

export type ConciergeChatResponse = ConciergeChatSuccessResponse | ConciergeErrorResponse;

// src/features/concierge/types.ts に追記

export type ConciergeHistoryItem = {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  // 一覧で使う想定のフィールドは必要になったら増やす
  summary?: string;
  last_question?: string;
  last_message_at: string; // 一覧用に追加
  last_message?: string | null; // 一覧用；なければ undefined でも OK
  message_count: number;
};
