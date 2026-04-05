"use client";

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
  isInitialBrowseMode?: boolean;

  // ✅ 外から強制的に ChatPanel を隠したい時に使う
  hideChatPanel?: boolean;
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
  } = props;

  const baseRootClass = "mx-auto max-w-4xl w-full min-w-0 flex flex-col px-4";
  const rootClass = embedMode
    ? `${baseRootClass} min-h-[400px]`
    : `${baseRootClass} flex-1 min-h-0 bg-neutral-50 overflow-hidden`;
  const mainClass = embedMode ? "flex flex-col w-full" : "flex flex-col flex-1 min-h-0 w-full h-full";

  // 通常の /concierge では下部チャットバーを出さない。
  // ChatPanel を使うのは embed 表示の時だけに固定する。
  const shouldRenderChatPanel = embedMode && props.hideChatPanel !== true;

  return (
    <div className={rootClass}>
      <main className={mainClass}>
        {children}

        {shouldRenderChatPanel ? (
          <ChatPanel
            messages={messages}
            loading={sending}
            sending={sending}
            error={error}
            onSend={onSend}
            canSend={canSend}
            onNewThread={onNewThread}
            embedMode={embedMode}
            hasCandidates={false}
          />
        ) : null}
      </main>
    </div>
  );
}
