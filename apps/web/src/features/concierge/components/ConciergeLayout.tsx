// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";
import { useEffect, useState } from "react";
import { useLandscape } from "@/hooks/useLandscape";
import ConciergeCard from "@/components/ConciergeCard";
import ChatPanel from "./ChatPanel";
import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import Link from "next/link";
import { useBilling } from "@/features/billing/hooks/useBilling";

function Spinner() {
  return <div className="py-6 text-center text-sm text-slate-500">読み込み中…</div>;
}
function Error({ message }: { message: string }) {
  return <div className="py-6 text-center text-sm text-red-600">{message}</div>;
}

const FREE_RECOMMEND_LIMIT = 1;
const PREMIUM_RECOMMEND_LIMIT = 3;

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

  const billing = useBilling();

  // ✅ Hooks は early return の前に全部呼ぶ必要があるので、補正ロジックはここでやる
  const isPremium = billing.loading || billing.error || !billing.status
    ? false
    : billing.status.plan === "premium" && billing.status.is_active;

  const limit = isPremium ? PREMIUM_RECOMMEND_LIMIT : FREE_RECOMMEND_LIMIT;
  const shownLen = Math.min(recommendations.length, limit);

  useEffect(() => {
    if (shownLen === 0) return;
    if (selectedIndex > shownLen - 1) setSelectedIndex(0);
  }, [shownLen, selectedIndex]);

  // --- ここから表示分岐 ---
  if (billing.loading) return <Spinner />;
  if (billing.error) return <Error message={billing.error} />;

  if (!billing.status) return <Spinner />;

  const status = billing.status; // ここでは存在する前提にできる
  const showPaywallHint = !(status.plan === "premium" && status.is_active);

  const shown = recommendations.slice(0, limit);

  const safeIndex = Math.min(selectedIndex, Math.max(0, shown.length - 1));
  const current = shown.length > 0 ? (shown[safeIndex] ?? shown[0]) : null;
  const isDummy = !!current?.__dummy;
  const locationText = current?.display_address ?? "";

  

  

  // 横向き UI
  if (isLandscape) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">AI神社コンシェルジュ</h2>
          <Link href="/billing" className="text-xs text-gray-600 underline hover:text-gray-900">
            プレミアムを見る
          </Link>
        </div>

        {showPaywallHint && (
          <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            無料版では一部機能に制限があります。プレミアムで制限解除できます。
          </div>
        )}

        {shown.length === 0 && (
          <p className="text-xs text-gray-500">
            横向きでは、候補の確認とルート案内だけ利用できます。
            チャットで相談したいときは、端末を縦向きにしてください。
          </p>
        )}

        {shown.length > 0 && (
          <>
            {isDummy && (
              <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                ※ 現在テスト中の回答（ベータ版）です。実際のレコメンドロジックは今後アップデート予定です。
              </div>
            )}

            <h3 className="mb-2 mt-1 text-xs font-semibold text-gray-600">今回のおすすめ神社</h3>
            <div className="space-y-3">
              {shown.map((r, idx) => (
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
      <div className="mb-2 flex items-center justify-end">
        <Link href="/billing" className="text-xs text-gray-600 underline hover:text-gray-900">
          プレミアムを見る
        </Link>
      </div>
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

      {showPaywallHint && (
        <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          無料版では一部機能に制限があります。プレミアムで制限解除できます。
        </div>
      )}

      {shown.length > 1 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {shown.map((_, idx) => {
            const active = idx === safeIndex;
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

      {current && (
        <div className="mt-4 space-y-2">
          {isDummy && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ※ 現在テスト中の回答（ベータ版）です。実際のレコメンドロジックは今後アップデート予定です。
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
