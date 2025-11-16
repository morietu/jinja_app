// src/features/concierge/components/ConciergeChatLog.tsx
import type { ConciergeChatMessage } from "../types";

type Props = {
  messages?: ConciergeChatMessage[];
  loading?: boolean;
  error?: string | null;
};



export function ConciergeChatLog({ messages, loading, error }: Props) {
  if (loading) return <p className="text-sm text-gray-500">会話ログを読み込み中…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!messages || messages.length === 0) {
    return <p className="text-xs text-gray-500">履歴が選択されていないか、会話ログがありません。</p>;
  }

  return (
    <div className="rounded-lg border bg-white max-h-80 overflow-y-auto p-3 space-y-3 text-sm">
      {messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === "user"
              ? "ml-auto max-w-[80%] rounded-lg bg-blue-600 text-white px-3 py-2"
              : "mr-auto max-w-[80%] rounded-lg bg-gray-100 text-gray-900 px-3 py-2"
          }
        >
          <p className="whitespace-pre-wrap break-words">{m.content}</p>
          <p className="mt-1 text-[10px] opacity-70 text-right">
            {new Date(m.created_at).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ))}
    </div>
  );
}
