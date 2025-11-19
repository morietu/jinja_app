// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useState, useMemo, useRef } from "react";
import { useConciergeThreads, useConciergeThreadDetail, useConciergeChat } from "../hooks";
import { ThreadList } from "./ThreadList";
import ChatPanel from "./ChatPanel";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";

export default function ConciergeLayout() {
  const { threads, loading: loadingThreads, setThreads, requiresLogin } = useConciergeThreads();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // メッセージ一覧（スレッド詳細）
  const { detail, loading: loadingDetail, setDetail } = useConciergeThreadDetail(selectedThreadId);

  // チャット結果のおすすめ候補
  const [recommendations, setRecommendations] = useState<ConciergeRecommendation[]>([]);

  // 候補＋ルートブロックの位置
  const candidatesRef = useRef<HTMLDivElement | null>(null);

  const { send, sending } = useConciergeChat(selectedThreadId, {
    onUpdated: ({ thread, messages, recommendations }) => {
      // 詳細を更新（recommendations は別 state で持つ）
      setDetail({ thread, messages });

      // スレッド一覧の更新（新規作成 or last_message_at 更新）
      setThreads((prev) => {
        const prevSafe = Array.isArray(prev) ? prev : [];
        const others = prevSafe.filter((t) => String((t as any).id) !== String((thread as any).id));
        return [thread, ...others];
      });

      // 新規スレッドなら自動的に選択（string に統一）
      setSelectedThreadId(String((thread as any).id));

      // おすすめ候補を state に反映
      setRecommendations(recommendations ?? []);

      // 候補セクションへスクロール（あれば）
      if ((recommendations?.length ?? 0) > 0 && candidatesRef.current) {
        candidatesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
  });

  const handleSelectThread = (id: string) => {
    setSelectedThreadId(id);
  };

  const handleStartNew = () => {
    setSelectedThreadId(null);
    setDetail(null);
    setRecommendations([]);
  };

  // 選択中スレッド（detail があればそれを、なければ一覧から探す）
  const activeThread: ConciergeThread | null = useMemo(() => {
    if (detail?.thread) return detail.thread;
    if (!selectedThreadId) return null;
    return (threads ?? []).find((t) => String((t as any).id) === selectedThreadId) ?? null;
  }, [detail, threads, selectedThreadId]);

  const messages = detail?.messages ?? [];

  return (
    <div className="mx-auto flex h-full max-w-md flex-col gap-4 px-4 py-4 md:max-w-5xl md:flex-row">
      {/* 上（スマホ） / 左（md+）：チャット */}
      <div className="flex-1 md:order-1">
        <ChatPanel thread={activeThread} messages={messages} loading={loadingDetail} sending={sending} onSend={send} />
      </div>

      {/* 下（スマホ） / 右（md+）：履歴＋候補＋ルート */}
      <div className="mt-4 flex-1 border-t pt-4 md:order-2 md:mt-0 md:border-t-0 md:border-l md:pl-4">
        {/* 履歴リスト（ログイン時のみ実データ、未ログインなら「ログインすると使えます」表示） */}
        <ThreadList
          threads={threads}
          loading={loadingThreads}
          requiresLogin={requiresLogin}
          selectedId={selectedThreadId}
          onSelect={handleSelectThread}
          onCreateNew={handleStartNew}
        />

        {/* 候補＋ルートのブロック */}
        <div ref={candidatesRef} className="mt-4">
          {recommendations.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold text-gray-600">今回のおすすめ神社</h3>
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
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
