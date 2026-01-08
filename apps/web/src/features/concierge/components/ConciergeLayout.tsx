// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatPanel from "./ChatPanel";

import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason } from "@/features/concierge/types/unified";

import { useBilling } from "@/features/billing/hooks/useBilling";
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
  embedMode?: boolean;
};

export default function ConciergeLayout({
  thread,
  messages,
  sending = false,
  error = null,
  onSend,
  onRetry,
  onNewThread,
  recommendations = [],
  paywallNote = null,
  remainingFree = null,
  stopReason,
  canSend,
  embedMode = false,
}: Props) {
  const [primaryIndex, setPrimaryIndex] = useState(0);

  // ✅ Hookは常に呼ぶ（Rule of Hooks）
  const billing = useBilling();

  const shown = recommendations;
  const shownLen = shown.length;

  // ✅ embedModeなら paywall 判定自体を潰す（UIも出さない）
  const isPremiumActive =
    !embedMode &&
    !billing.loading &&
    !billing.error &&
    billing.status?.plan === "premium" &&
    billing.status?.is_active === true;

  const hitPaywall = (typeof remainingFree === "number" && remainingFree <= 0) || !!paywallNote;
  const showPaywallHint = !embedMode && (stopReason === "paywall" || (hitPaywall && !isPremiumActive));

  useEffect(() => {
    if (shownLen === 0) return;
    setPrimaryIndex(0);
  }, [shownLen]);

  useEffect(() => {
    if (shownLen === 0) return;
    if (primaryIndex > shownLen - 1) setPrimaryIndex(0);
  }, [shownLen, primaryIndex]);

  const primary = shownLen > 0 ? (shown[primaryIndex] ?? shown[0]) : null;
  const isDummy = !!primary?.__dummy;
  const locationText = primary?.display_address ?? "";

  const wrapClass = embedMode ? "w-full flex flex-col" : "mx-auto mt-4 flex w-full max-w-xs flex-col md:max-w-sm";

  return (
    <div className={wrapClass}>
      {!embedMode && showPaywallHint && (
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
        <div className="mt-4">
          {!embedMode && isDummy && (
            <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ※ 現在テスト中の回答（ベータ版）です。
            </div>
          )}

          <h3 className="mb-2 text-xs font-semibold text-gray-600">今回のおすすめ</h3>
          {primary && <PrimaryRecommendationCard rec={primary} primaryIndex={primaryIndex} />}

          {!embedMode && (
            <RecommendationSwitchList items={shown} primaryIndex={primaryIndex} onSelect={setPrimaryIndex} />
          )}

          <div className="mt-3 text-[11px] text-slate-600">「地図で見る」でGoogleマップを開いてください。</div>
        </div>
      )}

      {!embedMode && primary && (
        <div className="mt-4 grid gap-2">
          <Link href="/map" className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900">
            近くの神社を探す
          </Link>

          <Link
            href="/concierge/history"
            className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            onClick={onNewThread}
          >
            新しい相談をする（履歴へ）
          </Link>

          {locationText ? <p className="mt-2 text-xs text-gray-500">{locationText}</p> : null}
        </div>
      )}
    </div>
  );
}
