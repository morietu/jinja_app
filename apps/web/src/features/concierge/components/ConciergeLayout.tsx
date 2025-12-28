"use client";

import { useEffect, useState } from "react";
import { useLandscape } from "@/hooks/useLandscape";
import ConciergeCard from "@/components/ConciergeCard";
import ChatPanel from "./ChatPanel";
import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import Link from "next/link";
import { useBilling } from "@/features/billing/hooks/useBilling";

function PaywallCta({ note }: { note: string }) {
  return (
    <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <div className="leading-relaxed">{note}</div>
      <div className="mt-2 flex gap-2">
        <Link
          href="/billing"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
        >
          プレミアムを見る
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
        >
          ログイン
        </Link>
      </div>
    </div>
  );
}

type StopReason = "design" | "paywall" | null;

type Props = {
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  onRetry: () => void;
  recommendations?: ConciergeRecommendation[];
  paywallNote?: string | null;
  remainingFree?: number | null;
  
  stopReason: StopReason;
  canSend: boolean;
};

export default function ConciergeLayout({
  thread,
  messages,
  sending,
  error,
  onSend,
  onRetry,
  recommendations = [],
  paywallNote = null,
  remainingFree = null,
  stopReason,
  canSend,
}: Props) {
  const isLandscape = useLandscape();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const billing = useBilling(); // 表示用（paywall根拠はサーバー側）
  const shown = recommendations;
  const shownLen = shown.length;

  const isPremiumActive =
    !billing.loading && !billing.error && billing.status?.plan === "premium" && billing.status?.is_active === true;

  // これだけでOK（stopReason/canSend 自体は計算しない）
  const hitPaywall = (typeof remainingFree === "number" && remainingFree <= 0) || !!paywallNote;

  // stopReason が paywall なら無条件で出す（devの force でも確実に出る）
  const showPaywallHint = stopReason === "paywall" || (hitPaywall && !isPremiumActive);

  const showStopBanner = stopReason !== null;

  useEffect(() => {
    if (shownLen === 0) return;
    if (selectedIndex > shownLen - 1) setSelectedIndex(0);
  }, [shownLen, selectedIndex]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, shown.length - 1));
  const current = shown.length > 0 ? (shown[safeIndex] ?? shown[0]) : null;
  const isDummy = !!current?.__dummy;
  const locationText = current?.display_address ?? "";

  console.debug("[concierge]", {
    isPremiumActive,
    remainingFree,
    showPaywallHint,
    canSend,
  });

  if (isLandscape) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">AI神社コンシェルジュ</h2>
        </div>

        {showPaywallHint && (
          <PaywallCta
            note={
              paywallNote ??
              (stopReason === "paywall"
                ? "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。"
                : "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。")
            }
          />
        )}

        {shown.length === 0 && (
          <p className="text-xs text-gray-500">
            横向きでは、候補の確認とルート案内だけ利用できます。チャットで相談したいときは、端末を縦向きにしてください。
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

  // 縦向き
  return (
    <div className="mx-auto mt-4 flex w-full max-w-xs flex-col md:max-w-sm">
      {showPaywallHint && (
        <PaywallCta note={paywallNote ?? "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。"} />
      )}
      <div className="flex-1">
        <ChatPanel
          thread={thread}
          messages={messages}
          loading={sending}
          sending={sending}
          error={error}
          onRetry={onRetry}
          onSend={onSend}
          canSend={canSend}
        />
      </div>

      {showStopBanner && stopReason === "design" && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <div className="font-semibold">ここまでで候補を出しました</div>
          <div className="mt-1 leading-relaxed">
            次は「地図で見る」で参拝の行動に移しましょう。続きの相談は「新しい相談」からできます。
          </div>
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
        <div className="mt-4 grid gap-2">
          <Link href="/nearby" className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900">
            近くの神社を探す
          </Link>

          <Link
            href="/concierge/history"
            className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            新しい相談をする（履歴へ）
          </Link>

          <button
            type="button"
            className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            onClick={() => {
              document.getElementById("concierge-reason")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            今回のおすすめ理由を見る
          </button>

          {locationText && <p className="mt-2 text-xs text-gray-500">{locationText}</p>}
        </div>
      )}
    </div>
  );
}
