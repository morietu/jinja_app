// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useMemo } from "react";
import ChatPanel from "./ChatPanel";
import type { ConciergeMessage } from "@/lib/api/concierge";
import type { ReactNode } from "react";

type Props = {
  messages: ConciergeMessage[];
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  onNewThread?: () => void;
  canSend: boolean;

  embedMode?: boolean;
  

  // 互換用（呼び出し側に残ってても落とさない）
  onRetry?: () => void;
  lastQuery?: string;
  hasCandidates?: boolean;

  children?: ReactNode;
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
    hasCandidates = false, // ✅ 追加
  } = props;

  const baseRootClass = "mx-auto max-w-4xl w-full min-w-0 flex flex-col px-4";
  const rootClass = embedMode
    ? `${baseRootClass} min-h-[400px]`
    : `${baseRootClass} flex-1 min-h-0 bg-neutral-50 overflow-hidden`;
  const mainClass = embedMode ? "flex flex-col w-full" : "flex flex-col flex-1 min-h-0 w-full h-full";

  const hasUserMessage = useMemo(() => messages.some((m) => m.role === "user" && m.content.trim()), [messages]);

  // ✅ 仕様：
  // - 候補あり & ユーザー未発話 & 非送信中 → チャットを隠す（候補 + 条件 がデフォ）
  // - それ以外 → チャット表示（候補なしの時は入口が必要 / 一度話したら会話画面）

  
  const isInitialBrowseMode = !hasUserMessage && hasCandidates;
  const hideChatPanel = !embedMode && isInitialBrowseMode && !sending;

  return (
    <div className={rootClass}>
      <main className={mainClass}>
        {children}

        {!hideChatPanel && (
          <ChatPanel
            messages={messages}
            loading={sending}
            sending={sending}
            error={error}
            onSend={onSend}
            canSend={canSend}
            onNewThread={onNewThread}
            embedMode={embedMode}
            hasCandidates={hasCandidates}
          />
        )}
      </main>
    </div>
  );
}
