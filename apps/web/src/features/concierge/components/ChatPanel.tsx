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
        flex flex-col
        rounded-2xl border bg-white px-3 py-3 shadow-sm
        h-[70vh] max-h-[520px] min-h-[360px]
      "
    >
      {/* ヘッダー：タイトル＋説明 */}
      <header className="mb-1 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold">{thread?.title ?? "今の気持ちをそのまま送ってください"}</h2>
          {/* ← この説明行は削る */}
          {/* <p className="text-[11px] text-gray-500">
      例：仕事・恋愛・健康・引っ越し・推し活・旅行の予定など。
    </p> */}
        </div>
        {sending && <p className="ml-2 text-[11px] text-gray-400">送信中…</p>}
      </header>

      {/* メッセージログ */}
      <div
        className="
    mb-2 flex-1 min-h-0
    overflow-y-auto rounded-xl bg-gray-50 px-3 py-2
  "
      >
        {loading && <p className="text-xs text-gray-500">相談履歴を読み込んでいます…</p>}

        {!loading && messages.length === 0 && (
          <p className="text-xs text-gray-500">
            いまの気持ちや相談したいことを、ひとことでも大丈夫なので送ってください。
          </p>
        )}

        {!loading && messages.length > 0 && <MessageList messages={messages} />}
      </div>

      {/* 入力欄：カードっぽく、下に固定される */}
      <div className="mt-auto w-full rounded-2xl border px-3 py-2 text-sm leading-relaxed">
        <ChatInput disabled={sending} onSend={handleSubmit} />
      </div>
    </section>
  );
}
