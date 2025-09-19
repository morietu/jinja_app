// apps/web/src/app/concierge/chat/page.tsx
"use client";
import { useState } from "react";
import { conciergeChat } from "@/lib/conciergeChat";
import ConciergeCard from "@/components/ConciergeCard";

type Shrine = {
  name: string;
  id?: number | null;
  place_id?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_m: number;
  duration_min: number;
  reason: string;
  // ConciergeCard 側の型に合わせておく（実害はないが警告回避）
  photo_url?: string | null;
};

type Plan = {
  plan_id?: string;
  summary: string;
  shrines: Shrine[];
  tips?: string[];
};

export default function ConciergeChatPage() {
  const [input, setInput] = useState("");
  const [transport, setTransport] =
    useState<"walking" | "driving" | "transit">("walking");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSend() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await conciergeChat(input, transport);
      setPlan(res);
    } catch (e: any) {
      setErr(e?.message ?? "取得に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-4 space-y-4">
      <h1 className="text-2xl font-bold">AI参拝コンシェルジュ（チャット）</h1>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          className="flex-1 border p-2 rounded"
          placeholder="例）恋愛運を上げたい。1時間で回れる所"
        />
        <select
          value={transport}
          onChange={(e) => setTransport(e.target.value as any)}
          className="border p-2 rounded"
        >
          <option value="walking">徒歩</option>
          <option value="driving">車</option>
          <option value="transit">公共交通</option>
        </select>
        <button
          onClick={onSend}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "作成中…" : "提案を作る"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {plan && (
        <section className="space-y-3">
          <p className="text-sm text-gray-600">{plan.summary}</p>

          <div className="space-y-2">
            {plan.shrines?.map((s, i) => (
              <ConciergeCard
                key={`${s.place_id ?? s.id ?? s.name}-${i}`}
                s={s}
                index={i}
                onImported={() => {}}
              />
            ))}
          </div>

          {(!plan.shrines || plan.shrines.length === 0) && (
            <p className="text-sm text-gray-500">近い候補が見つかりませんでした。</p>
          )}

          {!!plan.tips?.length && (
            <ul className="list-disc pl-5 text-sm text-gray-700">
              {plan.tips.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
