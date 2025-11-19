// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useState, useMemo, useRef } from "react";
import { useConciergeThreads, useConciergeThreadDetail, useConciergeChat } from "../hooks";
import { ThreadList } from "./ThreadList";
import ChatPanel from "./ChatPanel";
import { useLandscape } from "@/hooks/useLandscape";

import ConciergeCard from "@/components/ConciergeCard";
import type { ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";

// ルート案内用に選択中の神社情報
type SelectedRoute = {
  name: string;
  lat?: number | null;
  lng?: number | null;
  place_id?: string | null;
  distance_m: number;
  duration_min: number;
  gmapsLink?: string;
};

export default function ConciergeLayout() {
  const { threads, loading: loadingThreads, setThreads, requiresLogin } = useConciergeThreads();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // メッセージ一覧（スレッド詳細）
  const { detail, loading: loadingDetail, setDetail } = useConciergeThreadDetail(selectedThreadId);

  // チャット結果のおすすめ候補
  const [recommendations, setRecommendations] = useState<ConciergeRecommendation[]>([]);

  // ルート案内用：どの神社を選んだか
  const [selectedRoute, setSelectedRoute] = useState<SelectedRoute | null>(null);

  // 画面の向き
  const isLandscape = useLandscape();

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
      setSelectedRoute(null);

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
    setSelectedRoute(null);
  };

  // 選択中スレッド（detail があればそれを、なければ一覧から探す）
  const activeThread: ConciergeThread | null = useMemo(() => {
    if (detail?.thread) return detail.thread;
    if (!selectedThreadId) return null;
    return (threads ?? []).find((t) => String((t as any).id) === selectedThreadId) ?? null;
  }, [detail, threads, selectedThreadId]);

  const messages = detail?.messages ?? [];

  // === 横向き専用 UI ==========================================
  if (isLandscape) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">AI神社コンシェルジュ（スポット×ルート）</h2>

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

              {/* 候補カード（ConciergeCard 縦リスト） */}
              <div className="mb-4 space-y-3">
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
                    onRouteSelect={(payload) => setSelectedRoute(payload)}
                  />
                ))}
              </div>

              {/* ルート案内 UI */}
              <section className="rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-700">
                <h4 className="mb-1 text-sm font-semibold">ルート案内</h4>

                {!selectedRoute && (
                  <p className="leading-relaxed">
                    候補カードの「地図で見る」をタップすると、ここにルート案内が表示されます。
                  </p>
                )}

                {selectedRoute && (
                  <>
                    <p className="text-sm font-semibold">{selectedRoute.name}</p>
                    <p className="mt-1">
                      距離 <span className="font-medium">{(selectedRoute.distance_m / 1000).toFixed(1)} km</span> ／
                      目安 <span className="font-medium">{selectedRoute.duration_min} 分</span>
                    </p>

                    <p className="mt-2 leading-relaxed">
                      すでに Googleマップでルートを開いている場合は、そのままナビを開始できます。
                      別の候補に切り替えたいときは、他の神社の「地図で見る」をタップしてください。
                    </p>

                    {selectedRoute.gmapsLink && (
                      <a
                        href={selectedRoute.gmapsLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Googleマップでルートを開く
                      </a>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
