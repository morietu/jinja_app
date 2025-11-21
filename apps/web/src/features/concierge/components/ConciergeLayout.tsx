"use client";

import { useLandscape } from "@/hooks/useLandscape";
import ConciergeCard from "@/components/ConciergeCard";
import ChatPanel from "./ChatPanel";
import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";

type Props = {
  // チャット関連は親から全部もらう
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  onRetry: () => void;

  // 将来おすすめを親で持つならここに足す
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
                気になる神社の「地図で見る」をタップすると、 Googleマップで現在地からのルートを開きます。
              </p>
              <p className="mt-1 leading-relaxed">
                複数まわりたいときは、行きたい順に「地図で見る」を開いて ルートを調整してください。
              </p>
            </section>
          </>
        )}
      </div>
    );
  }

  // === 縦向き（通常） UI ======================================
  return (
    <div className="mt-4 mx-auto w-full max-w-xs md:max-w-sm">
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
    </div>
  );
}
