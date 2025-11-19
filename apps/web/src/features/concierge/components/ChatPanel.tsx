// apps/web/src/features/concierge/components/ChatPanel.tsx
import React from "react";
import type { ConciergeThread, ConciergeMessage } from "@/lib/api/concierge";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

type Props = {
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  loading: boolean;
  sending: boolean;
  // send() は ConciergeChatResponse を返すので、戻り値を unknown にする
  onSend: (text: string) => Promise<unknown> | void;
};

export default function ChatPanel({ thread, messages, loading, sending, onSend }: Props) {
  const handleSubmit = async (text: string) => {
    await onSend(text);
  };

  return (
    <section
      className="
        mx-auto w-full
        flex h-full flex-col
        rounded-xl border bg-white px-3 py-2 shadow-sm min-h-[220px]
      "
    >
      {/* タイトル行 */}
      <header className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{thread?.title ?? "今の気持ちから相談する"}</h2>
        {/* 右上に小さくステータス */}
        {sending && <p className="text-[11px] text-gray-400">送信中…</p>}
      </header>

      {/* メッセージログ */}
      <div className="mb-2 flex-1 overflow-y-auto rounded-xl bg-gray-50 px-3 py-2 min-h-[120px]">
        {loading && <p className="text-xs text-gray-500">相談履歴を読み込んでいます…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-gray-500">
            悩みや状況をそのまま書いてください。コンシェルジュが神社を提案します。
          </p>
        )}
        {!loading && messages.length > 0 && <MessageList messages={messages} />}
      </div>

      {/* 入力欄：最低44px確保 */}
      <div className="w-full rounded-xl border px-3 py-2 text-sm leading-relaxed min-h-[44px]">
        <ChatInput disabled={sending} onSend={handleSubmit} />
      </div>
    </section>
  );
}
