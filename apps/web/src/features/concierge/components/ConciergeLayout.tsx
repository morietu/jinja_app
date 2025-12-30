"use client";

import { useEffect, useState } from "react";
import { useLandscape } from "@/hooks/useLandscape";

import ChatPanel from "./ChatPanel";
import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import Link from "next/link";
import { useBilling } from "@/features/billing/hooks/useBilling";
import type { StopReason } from "@/features/concierge/types/unified";
import PrimaryRecommendationCard from "@/features/concierge/components/PrimaryRecommendationCard";
import RecommendationSwitchList from "@/features/concierge/components/RecommendationSwitchList";



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



type Props = {
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  onRetry: () => void;
  onNewThread?: () => void;
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
  onNewThread,
  recommendations = [],
  paywallNote = null,
  remainingFree = null,
  stopReason,
  canSend,
}: Props) {
  const isLandscape = useLandscape();
  const [primaryIndex, setPrimaryIndex] = useState(0);
  


  const billing = useBilling(); // 表示用（paywall根拠はサーバー側）
  const shown = recommendations;
  const shownLen = shown.length;

  const isPremiumActive =
    !billing.loading && !billing.error && billing.status?.plan === "premium" && billing.status?.is_active === true;

  // これだけでOK（stopReason/canSend 自体は計算しない）
  const hitPaywall = (typeof remainingFree === "number" && remainingFree <= 0) || !!paywallNote;

  // stopReason が paywall なら無条件で出す（devの force でも確実に出る）
  const showPaywallHint = stopReason === "paywall" || (hitPaywall && !isPremiumActive);



  // recommendations が更新されたら primary を先頭に戻す（挙動安定）
  useEffect(() => {
    if (shownLen === 0) return;
    setPrimaryIndex(0);
  }, [shownLen]);

  // primaryIndex が範囲外に出た時の保険
  useEffect(() => {
    if (shownLen === 0) return;
    if (primaryIndex > shownLen - 1) setPrimaryIndex(0);
  }, [shownLen, primaryIndex]);  

  const primary = shownLen > 0 ? (shown[primaryIndex] ?? shown[0]) : null;
  const isDummy = !!primary?.__dummy;
  const locationText = primary?.display_address ?? "";


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
          <PaywallCta note={paywallNote ?? "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。"} />
        )}

        {shownLen === 0 ? (
          <p className="text-xs text-gray-500">
            横向きでは、候補の確認とルート案内だけ利用できます。チャットで相談したいときは、端末を縦向きにしてください。
          </p>
        ) : (
          <>
            {isDummy && (
              <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                ※ 現在テスト中の回答（ベータ版）です。実際のレコメンドロジックは今後アップデート予定です。
              </div>
            )}

            <h3 className="mb-2 mt-1 text-xs font-semibold text-gray-600">今回のおすすめ</h3>

            {primary && <PrimaryRecommendationCard rec={primary} primaryIndex={primaryIndex} />}

            <RecommendationSwitchList items={shown} primaryIndex={primaryIndex} onSelect={setPrimaryIndex} />

            <section className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-700">
              <h4 className="mb-1 text-sm font-semibold">次にやること</h4>
              <p className="leading-relaxed">「地図で見る」でGoogleマップを開いてください。</p>
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

      {shownLen > 0 && (
        <>
          {isDummy && (
            <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ※ 現在テスト中の回答（ベータ版）です。
            </div>
          )}

          <h3 className="mb-2 mt-1 text-xs font-semibold text-gray-600">今回のおすすめ</h3>

          {primary && <PrimaryRecommendationCard rec={primary} primaryIndex={primaryIndex} />}

          <RecommendationSwitchList items={shown} primaryIndex={primaryIndex} onSelect={setPrimaryIndex} />

          <section className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-700">
            <h4 className="mb-1 text-sm font-semibold">次にやること</h4>
            <p className="leading-relaxed">「地図で見る」でGoogleマップを開いてください。</p>
          </section>
        </>
      )}

      {primary ? (
        <div className="mt-4 grid gap-2">
          <Link href="/nearby" className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900">
            近くの神社を探す
          </Link>

          <Link
            href="/concierge/history"
            className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            onClick={onNewThread}
          >
            新しい相談をする（履歴へ）
          </Link>

          {locationText && <p className="mt-2 text-xs text-gray-500">{locationText}</p>}
        </div>
      ) : stopReason === "design" ? (
        <div className="mt-4 text-xs text-slate-500">候補がありません。条件を変えてもう一度お試しください。</div>
      ) : null}
    </div>
  );
}
