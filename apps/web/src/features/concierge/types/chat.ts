// apps/web/src/features/concierge/types/chat.ts
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";

/**
 * Concierge UI の単一ソースは events。
 * - 表示: user_message / assistant_reply
 * - 状態: assistant_state（UI制御用。表示しない）
 *
 * ここを崩す変更は「仕様変更」扱いにする（安易に増やさない）。
 */
export type ChatEvent =
  | { type: "user_message"; text: string; at: string }
  | { type: "assistant_reply"; text: string; at: string }
  | { type: "assistant_state"; unified: UnifiedConciergeResponse; at: string };
