// apps/web/src/features/concierge/ConciergeLayout.tsx
"use client";
import { useState } from "react";
import { useLandscape } from "@/hooks/useLandscape";
import ConciergeCard from "@/components/ConciergeCard";
import ChatPanel from "./ChatPanel";
import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";

type Props = {
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  onRetry: () => void;
  recommendations?: ConciergeRecommendation[];
};

export default function ConciergeLayout({
  thread,
  messages,
  sending,
  error,
  onSend,
  onRetry,
  recommendations = [],
}: Props) {
  const isLandscape = useLandscape();

  const [selectedIndex, setSelectedIndex] = useState(0);

  const current = recommendations.length > 0 ? (recommendations[selectedIndex] ?? recommendations[0]) : null;

  const isDummy = !!current?.__dummy;

  const locationText = current?.display_address ?? "";

  // 横向き UI
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
            {isDummy && (
              <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                ※ 現在テスト中の回答（ベータ版）です。実際のレコメンドロジックは今後アップデート予定です。
              </div>
            )}

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
                    distance_m: r.distance_m ?? 0,
                    duration_min: r.duration_min ?? 0,
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

  // 縦向き（通常） UI
  return (
    <div className="mt-4 mx-auto flex w-full max-w-xs flex-col md:max-w-sm">
      <div className="flex-1">
        <ChatPanel
          thread={thread}
          messages={messages}
          loading={sending}
          sending={sending}
          error={error}
          onRetry={onRetry}
          onSend={onSend}
        />
      </div>

      {current && (
        <div className="mt-4 space-y-2">
          {isDummy && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ※ 現在テスト中の回答（ベータ版）です。実際のレコメンドロジックは今後アップデート予定です。
            </div>
          )}

          {recommendations.length > 1 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {recommendations.map((_, idx) => {
                const active = idx === selectedIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`rounded-full border px-3 py-1 ${
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    候補{idx + 1}
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
            <div className="mb-1 text-xs font-semibold text-gray-500">今回の候補</div>
            <div className="text-base font-semibold">{current.display_name || current.name}</div>

            {current.reason && <p className="mt-1 text-sm text-gray-700">{current.reason}</p>}

            {locationText && <p className="mt-2 text-xs text-gray-500">{locationText}</p>}

            {(current.distance_m ?? 0) > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                およそ {(current.distance_m! / 1000).toFixed(1)} km ／{(current.duration_min ?? 0).toFixed(0)} 分
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
