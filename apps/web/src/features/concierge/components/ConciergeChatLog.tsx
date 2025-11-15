// src/features/concierge/components/ConciergeChatLog.tsx
import type { ConciergeChatMessage } from "../types";

type Props = {
  messages?: ConciergeChatMessage[];
  loading?: boolean;
  error?: string | null;
};

function roleLabel(role: ConciergeChatMessage["role"]): string {
  if (role === "user") return "あなた";
  if (role === "assistant") return "コンシェルジュ";
  return "system";
}

export function ConciergeChatLog({ messages, loading, error }: Props) {
  if (loading) {
    return <p className="text-xs text-gray-500">履歴の会話ログを読み込み中…</p>;
  }

  if (error) {
    return <p className="text-xs text-red-500">{error || "履歴の詳細を取得できませんでした。"}</p>;
  }

  if (!messages || messages.length === 0) {
    return <p className="text-xs text-gray-500">履歴が選択されていないか、会話ログがありません。</p>;
  }

  return (
    <div className="rounded border bg-white p-3 space-y-2 max-h-64 md:max-h-80 overflow-y-auto text-sm">
      {messages.map((m) => (
        <div key={m.id} className="flex gap-2">
          {/* ロールラベル */}
          <span className="font-semibold text-xs text-gray-500 w-20 shrink-0">{roleLabel(m.role)}</span>
          {/* 本文 */}
          <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
        </div>
      ))}
    </div>
  );
}
