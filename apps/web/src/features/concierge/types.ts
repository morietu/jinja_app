// src/features/concierge/types.ts

// クライアントから送る payload
export type ConciergeChatRequest = {
  message?: string; // 新UIは基本こっち
  query?: string; // 既存互換
  lat?: number;
  lng?: number;
  transport?: "walking" | "driving" | "transit";
  candidates?: ConciergeCandidate[];
  threadId?: number;
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

  // 既存フィールド
  data: ConciergeChatData;
  note?: string;

  // バックエンドの echo 用 reply（必須stringにする）
  reply: string;

  // LLMの推薦結果（ConciergeSuggestions を流用）
  suggestions?: ConciergeSuggestions | null;

  // バックエンドの thread_payload（snake_case）
  thread?: {
    id: number;
    title: string;
    last_message: string | null;
    last_message_at: string | null;
    message_count: number;
  } | null;
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

// チャット送信ペイロード
export type ConciergeChatMessagePayload = {
  message: string;
  lat: number;
  lng: number;
  transport?: "walking" | "driving" | "transit";
  candidates?: ConciergeCandidate[];
  threadId?: number;
};

// バックエンドに送る「候補神社」の形
export type ConciergeCandidate = {
  name: string;
  formatted_address: string;
};

// Orchestrator.suggest から返ってくる推奨結果（簡易定義）
export type ConciergeRecommendation = {
  name: string;
  reason: string;
};

export type ConciergeSuggestions = {
  recommendations: ConciergeRecommendation[];
};

// スレッド情報（フロントではcamelCaseで扱う）
export type ConciergeThreadSummary = {
  id: number;
  title: string;
  lastMessage: string | null;
  lastMessageAt: string | null; // ISO string
  messageCount: number;
};

// /api/concierge/chat のレスポンス


// チャットUIで使う1メッセージの形（フロント内部用）
export type ChatMessageRole = "user" | "assistant";

export type ChatMessageItem = {
  id: string;
  role: ChatMessageRole;
  text: string;
  createdAt: Date;
};
