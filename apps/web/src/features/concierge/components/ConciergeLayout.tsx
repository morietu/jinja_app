// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import * as React from "react";
import ChatPanel from "./ChatPanel";
import type { ConciergeMessage, ConciergeRecommendation } from "@/lib/api/concierge";

type Props = {
  messages: ConciergeMessage[];
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  onNewThread?: () => void;

  recommendations?: ConciergeRecommendation[];
  needTags?: string[];

  paywallNote?: string | null;
  remainingFree?: number | null;
  stopReason?: string | null;
  canSend: boolean;

  embedMode?: boolean;

  // ✅ 互換用（呼び出し側に残ってても落とさない）
  onRetry?: () => void;
  lastQuery?: string;
};

export default function ConciergeLayout(props: Props) {
  const {
    messages,
    sending = false,
    error = null,
    onSend,
    onNewThread,
    recommendations = [],
    needTags = [],
    canSend,
    embedMode = false,
  } = props;

  // ✅ 画面設計の責任者
  // - 非embed: 画面高固定 + overflow-hidden（内部スクロールに寄せる）
  // - embed: 高さ固定しない（ページの流れに従う）、ただし最低限の高さを確保
  const rootClass = embedMode ? "w-full" : "h-full min-h-0 w-full bg-neutral-50 flex flex-col overflow-hidden";

  // ✅ ChatPanel には「親が決めた高さ」を渡す
  const mainClass = embedMode ? "w-full" : "flex-1 min-h-0";
  
  const chatWrapClass = embedMode ? "w-full" : "flex-1 min-h-0 w-full";

  

  return (
    <div className={rootClass}>
      <main className={mainClass}>
        <div className={chatWrapClass}>
          <div className={embedMode ? "w-full" : "w-full max-w-sm h-full min-h-0"}>
            <ChatPanel
              messages={messages}
              loading={sending}
              sending={sending}
              error={error}
              onSend={onSend}
              canSend={canSend}
              recommendations={recommendations}
              needTags={needTags}
              onNewThread={onNewThread}
              embedMode={embedMode}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
