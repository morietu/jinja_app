// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useState } from "react";
import { useConciergeChat } from "../hooks";
import ChatPanel from "./ChatPanel";
import { useLandscape } from "@/hooks/useLandscape";
import Link from "next/link";
import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeRecommendation, ConciergeMessage } from "@/lib/api/concierge";

export default function ConciergeLayout() {
  // チャットのメッセージをローカルで管理
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  // 将来 LLM が返すおすすめ用（今は空のままでもOK）
  const [recommendations] = useState<ConciergeRecommendation[]>([]);

  // 画面の向き
  const isLandscape = useLandscape();

  // 簡易的な message オブジェクト生成ヘルパー
  const makeMessage = (role: "user" | "assistant", content: string): ConciergeMessage => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    thread_id: 1, // 仮
    role,
    content,
    created_at: new Date().toISOString(),
  });

  // チャット送信用フック（いまは threadId なしでOK）
  const { send, sending } = useConciergeChat(null, {
    onReply: (reply) => {
      setMessages((prev) => [...prev, makeMessage("assistant", reply)]);
    },
  });

  // 入力送信時：まず user メッセージを積んでから送信
  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, makeMessage("user", trimmed)]);
    await send(trimmed);
  };

  // === 横向き専用 UI ==========================================
  if (isLandscape) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">AI神社コンシェルジュ</h2>

        {recommendations.length === 0 && (
          <p className="text-xs text-gray-500">
            横向きでは、候補の確認とルート案内だけ利用できます。
            チャットで相談したいときは、端末を縦向きにしてください。
          </p>
        )}

        {recommendations.length > 0 && (
          <>
            <h3 className="mb-2 mt-1 text-xs font-semibold text-gray-600">今回のおすすめ神社</h3>
            <div className="space-y-3">
              {recommendations.map((r, idx) => (
                <ConciergeCard
                  key={r.id ?? r.place_id ?? idx}
                  s={{
                    name: r.name,
                    id: (r as any).shrine_id ?? r.id ?? null,
                    place_id: r.place_id ?? null,
                    address: r.address ?? null,
                    lat: r.lat ?? null,
                    lng: r.lng ?? null,
                    distance_m: r.distance_m,
                    duration_min: r.duration_min,
                    reason: r.reason,
                    photo_url: r.photo_url ?? null,
                  }}
                  index={idx}
                  showMapButton
                />
              ))}
            </div>

            <section className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-700">
              <h4 className="mb-1 text-sm font-semibold">ルート案内</h4>
              <p className="leading-relaxed">
                気になる神社の「地図で見る」をタップすると、Googleマップで現在地からのルートを開きます。
              </p>
              <p className="mt-1 leading-relaxed">
                複数まわりたいときは、行きたい順に「地図で見る」を開いてルートを調整してください。
              </p>
            </section>
          </>
        )}
      </div>
    );
  }

  // === 縦向き用（通常） UI ====================================
  return (
    <div className="mt-4 mx-auto w-full max-w-xs md:max-w-sm">
      {/* 上：チャット */}
      <div className="flex-1">
        <ChatPanel thread={null} messages={messages} loading={false} sending={sending} onSend={handleSend} />
      </div>

      {/* 下：クイックメニューカード 3つ */}
      <nav className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        {/* 1. 地図表示 */}
        <Link
          href="/"
          className="flex flex-col items-center justify-center rounded-xl border bg-white px-2 py-3 shadow-sm"
        >
          <span className="mb-1 text-base">🗺</span>
          <span className="font-medium">地図で見る</span>
        </Link>

        {/* 2. マイページ */}
        <Link
          href="/mypage" // TODO: 実際のマイページのパスに合わせて変える
          className="flex flex-col items-center justify-center rounded-xl border bg-white px-2 py-3 shadow-sm"
        >
          <span className="mb-1 text-base">👤</span>
          <span className="font-medium">マイページ</span>
        </Link>

        {/* 3. 設定 or 履歴 */}
        <Link
          href="/concierge/history" // 設定ページができたら /settings などに差し替え
          className="flex flex-col items-center justify-center rounded-xl border bg-white px-2 py-3 shadow-sm"
        >
          <span className="mb-1 text-base">📂</span>
          <span className="font-medium">履歴・設定</span>
        </Link>
      </nav>
    </div>
  );
}
