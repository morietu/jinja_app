// apps/web/src/features/concierge/components/ConciergeChat.tsx
import { useState } from "react";
import { useConciergeChatSession } from "../hooks/useConciergeChat";
import type { ChatMessageItem, ConciergeRecommendation } from "../types";
import { ConciergeSuggestionsPanel } from "./ConciergeSuggestionsPanel";

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

  function handleShowMap(rec: ConciergeRecommendation) {
    // TODO: ここでマップ連携。まずは console.log にしておいて、
    // 次のタスクで GoogleMap コンポーネント / ルート画面に繋げる
    console.log("map for:", rec.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    await sendMessage(text);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-3">
      {/* チャットログ */}
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

      {/* 候補神社カード */}
      {lastResponse?.suggestions && (
        <ConciergeSuggestionsPanel
          recommendations={lastResponse.suggestions.recommendations}
          onShowMap={handleShowMap}
        />
      )}

      {/* エラー表示 */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 入力フォーム */}
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
