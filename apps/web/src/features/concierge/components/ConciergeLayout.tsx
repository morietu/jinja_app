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

  const baseRootClass = "mx-auto max-w-4xl w-full min-w-0 flex flex-col px-4";

  const rootClass = embedMode
    ? `${baseRootClass} min-h-[400px]`
    : `${baseRootClass} flex-1 min-h-0 bg-neutral-50 overflow-hidden`;

  const mainClass = embedMode ? "flex flex-col w-full" : "flex flex-col flex-1 min-h-0 w-full h-full";

  return (
    <div className={rootClass}>
      <main className={mainClass}>
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
      </main>
    </div>
  );
}
