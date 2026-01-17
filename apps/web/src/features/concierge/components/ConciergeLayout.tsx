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

  // ✅ 互換用（呼び出し側に残っていても落とさない）
  recommendations?: ConciergeRecommendation[];
  needTags?: string[];
  onRetry?: () => void;
  lastQuery?: string;

  paywallNote?: string | null;
  remainingFree?: number | null;
  stopReason?: string | null;
  canSend: boolean;

  embedMode?: boolean;

  // ✅ 下にセクションUIを差し込むスロット
  children?: React.ReactNode;
};

export default function ConciergeLayout(props: Props) {
  const {
    messages,
    sending = false,
    error = null,
    onSend,
    onNewThread,
    canSend,
    embedMode = false,
    children,

    // eslint 対策：受け取るだけ（使わない）
    recommendations: _recommendations,
    needTags: _needTags,
    onRetry: _onRetry,
    lastQuery: _lastQuery,
    paywallNote: _paywallNote,
    remainingFree: _remainingFree,
    stopReason: _stopReason,
  } = props;

  const baseRootClass = "mx-auto max-w-4xl w-full min-w-0 flex flex-col px-4";
  const rootClass = embedMode
    ? `${baseRootClass} min-h-[400px]`
    : `${baseRootClass} flex-1 min-h-0 bg-neutral-50 overflow-hidden`;

  const mainClass = embedMode ? "flex flex-col w-full" : "flex flex-col flex-1 min-h-0 w-full h-full";

  return (
    <div className={rootClass}>
      <main className={mainClass}>
        {/* 上：会話 */}
        <ChatPanel
          messages={messages}
          loading={sending}
          sending={sending}
          error={error}
          onSend={onSend}
          canSend={canSend}
          onNewThread={onNewThread}
          embedMode={embedMode}
        />

        {/* 下：おすすめ/内訳/次アクション（差し込み） */}
        {children ? <div className="shrink-0">{children}</div> : null}
      </main>
    </div>
  );
}
