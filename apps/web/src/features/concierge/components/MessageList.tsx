import type { ConciergeMessage } from "@/lib/api/concierge";

type Props = {
  messages: ConciergeMessage[];
  loading?: boolean;
  error?: string | null;
};

export default function MessageList({ messages, loading, error }: Props) {
  if (loading) return <p>読み込み中…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!messages || messages.length === 0) {
    return <p className="text-sm text-gray-500">まだ会話がありません。</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[80%] rounded px-3 py-2 ${m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            <p>{m.content}</p>
            <p className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
