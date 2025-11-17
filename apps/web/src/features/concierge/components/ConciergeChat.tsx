// apps/web/src/features/concierge/components/ConciergeChat.tsx
import { useState } from "react";
import { useConciergeChatSession } from "../hooks/useConciergeChat";
import type { ChatMessageItem, ConciergeRecommendation } from "../types";

type Props = {
  lat: number;
  lng: number;
  candidates?: { name: string; formatted_address: string }[];
};

export function ConciergeChat({ lat, lng, candidates }: Props) {
  const [input, setInput] = useState("");
  const { messages, lastResponse, isLoading, error, sendMessage } = useConciergeChatSession({
    initialLat: lat,
    initialLng: lng,
    initialCandidates: candidates,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    await sendMessage(text);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border rounded-lg p-3 h-64 overflow-y-auto text-sm">
        {messages.map((m: ChatMessageItem) => (
          <div key={m.id} className={m.role === "user" ? "text-right mb-2" : "text-left mb-2"}>
            <div className="inline-block px-2 py-1 rounded-md bg-gray-100">{m.text}</div>
          </div>
        ))}

        {!messages.length && (
          <p className="text-xs text-gray-500">
            いまの気持ちや相談ごとを入力して「送信」を押すと、コンシェルジュが神社を提案します。
          </p>
        )}
      </div>

      {lastResponse?.suggestions && (
        <div className="text-xs border rounded-lg p-2 bg-gray-50">
          <p className="font-semibold mb-1">候補の神社</p>
          <ul className="list-disc list-inside">
            {lastResponse.suggestions.recommendations.map((r: ConciergeRecommendation) => (
              <li key={r.name}>
                <span className="font-medium">{r.name}</span>: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 border rounded-md px-2 py-1 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例：仕事運を上げたい、都内でおすすめの神社は？"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-3 py-1 text-sm rounded-md border bg-white disabled:opacity-60"
        >
          {isLoading ? "送信中..." : "送信"}
        </button>
      </form>
    </div>
  );
}
