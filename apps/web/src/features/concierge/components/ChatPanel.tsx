// apps/web/src/features/concierge/components/ChatPanel.tsx
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
    <div className="flex h-full flex-col">
      <div className="mb-2 border-b pb-2">
        <h2 className="text-lg font-semibold">{thread?.title ?? "新しい相談"}</h2>
      </div>

      <div className="flex-1 overflow-y-auto border-b pb-2">
        {loading && <p className="text-sm text-gray-500">読み込み中...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-gray-500">ここにコンシェルジュとの会話が表示されます。</p>
        )}
        {!loading && messages.length > 0 && <MessageList messages={messages} />}
      </div>

      <div className="pt-2">
        <ChatInput disabled={sending} onSend={handleSubmit} />
      </div>
    </div>
  );
}
