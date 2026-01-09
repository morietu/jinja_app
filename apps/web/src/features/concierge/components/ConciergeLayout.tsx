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

  const billing = useBilling();

  const shown = recommendations;
  const shownLen = shown.length;

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

  // ✅ reasonブロック用（primary がないときは表示しないので、ここはシンプルでOK）
  const title = primary?.display_name ?? primary?.name ?? "おすすめの神社";
  const reason =
    (primary as any)?.reason ||
    (primary as any)?.comment ||
    "条件に合う神社を候補から選びました。必要なら条件を追加できます。";

  const bullets: string[] = (primary as any)?.bullets ??
    (primary as any)?.highlights ?? ["落ち着いて参拝しやすい", "人が多すぎない可能性", "境内の雰囲気が合う可能性"];

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

          <div className="mb-2">
            <h3 className="text-xs font-semibold text-gray-700">今回のおすすめ（AIの提案）</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              「理由」を見てピンと来たら、まずはこの神社から。条件を足したい場合は、続けて入力してください。
            </p>
          </div>

          {primary && (
            <div className="rounded-xl border bg-white px-3 py-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">{title}</div>
              <div className="mt-1">{reason}</div>

              <div className="mt-2 text-[11px] text-slate-500">［補足］</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-600">
                {bullets.slice(0, 3).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>

              <div className="mt-2 text-[11px] text-slate-500">
                条件を追加したい場合は、このまま続けて入力してください。
              </div>
            </div>
          )}

          {primary && <PrimaryRecommendationCard rec={primary} primaryIndex={primaryIndex} />}

          {!embedMode && (
            <RecommendationSwitchList items={shown} primaryIndex={primaryIndex} onSelect={setPrimaryIndex} />
          )}

          <div className="mt-3 text-[11px] text-slate-600">
            気になる神社があれば「地図で見る」で場所を確認できます。
          </div>

          {!embedMode && (
            <div className="mt-2 text-[11px] text-slate-500">
              ほかも比較したい場合は、下の「他も見て選ぶ（地図）」から探せます。
            </div>
          )}
        </div>
      )}

      {!embedMode && primary && (
        <div className="mt-4 grid gap-2">
          <Link href="/map" className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900">
            他も見て選ぶ（地図）
          </Link>

          <Link
            href="/concierge/history"
            className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            onClick={onNewThread}
          >
            条件を追加して絞る（履歴へ）
          </Link>

          {locationText ? <p className="mt-2 text-xs text-gray-500">{locationText}</p> : null}
        </div>
      )}
    </div>
  );
}
