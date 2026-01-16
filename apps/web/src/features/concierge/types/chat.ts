import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";

export type AssistantStateEvent = {
  type: "assistant_state";
  unified: UnifiedConciergeResponse;
  at: string;
};

export type ChatEvent =
  | { type: "user_message"; text: string; at: string }
  | { type: "assistant_reply"; text: string; at: string }
  | AssistantStateEvent;
