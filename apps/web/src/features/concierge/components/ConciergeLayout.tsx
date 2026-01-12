// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatPanel from "./ChatPanel";

import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason } from "@/features/concierge/types/unified";

import { useBilling } from "@/features/billing/hooks/useBilling";
import RecommendationUnit from "@/components/concierge/RecommendationUnit";

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

/**
 * ✅ 非embedの時だけ使う課金ゲート
 * - ConciergeLayout 本体から useBilling を完全に排除するために、この子に閉じ込める
 */
function BillingGate({
  stopReason,
  paywallNote,
  remainingFree,
}: {
  stopReason: StopReason;
  paywallNote?: string | null;
  remainingFree?: number | null;
}) {
  const billing = useBilling();

  const isPremiumActive =
    !billing.loading && !billing.error && billing.status?.plan === "premium" && billing.status?.is_active === true;

  const hitPaywall = (typeof remainingFree === "number" && remainingFree <= 0) || !!paywallNote;
  const showPaywallHint = stopReason === "paywall" || (hitPaywall && !isPremiumActive);

  if (!showPaywallHint) return null;

  return <PaywallCta note={paywallNote ?? "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。"} />;
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

  // ✅ embedの「直近条件」
  lastQuery?: string | null;
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
  lastQuery = null,
}: Props) {
  const [primaryIndex, setPrimaryIndex] = useState(0);

  const shown = recommendations;
  const shownLen = shown.length;

  useEffect(() => {
    if (shownLen === 0) return;
    setPrimaryIndex(0);
  }, [shownLen]);

  useEffect(() => {
    if (shownLen === 0) return;
    if (primaryIndex > shownLen - 1) setPrimaryIndex(0);
  }, [shownLen, primaryIndex]);


  const first = recommendations?.[0] ?? null;

  const primary = shownLen > 0 ? (shown[primaryIndex] ?? shown[0]) : null;

  const isDummy = !!(primary as any)?.__dummy;
  const locationText = (primary as any)?.display_address ?? "";

  const wrapClass = embedMode ? "w-full flex flex-col" : "mx-auto mt-4 flex w-full max-w-xs flex-col md:max-w-sm";

  // --- 詳細リンク解決（shrine_id > place_id の順）---
  const rawPlaceId =
    (primary as any)?.place_id ?? (primary as any)?.placeId ?? (primary as any)?.google_place_id ?? null;
  const placeId = rawPlaceId != null ? String(rawPlaceId) : null;

  const rawShrineId = (primary as any)?.shrine_id ?? (primary as any)?.id ?? null;
  const shrineId = typeof rawShrineId === "number" ? rawShrineId : rawShrineId != null ? Number(rawShrineId) : null;

  const detailHref =
    typeof shrineId === "number" && Number.isFinite(shrineId) && shrineId > 0
      ? `/shrines/${shrineId}`
      : placeId
        ? `/shrines/from-place/${placeId}`
        : null;

  // --- 表示用テキスト ---
  const title = (primary as any)?.display_name ?? (primary as any)?.name ?? "おすすめの神社";
  const reason =
    (primary as any)?.reason ||
    (primary as any)?.comment ||
    "条件に合う神社を候補から選びました。必要なら条件を追加できます。";

  const bullets: string[] = (primary as any)?.bullets ??
    (primary as any)?.highlights ?? ["落ち着いて参拝しやすい", "人が多すぎない可能性", "境内の雰囲気が合う可能性"];

  const lastQueryView = (lastQuery ?? "").trim();

    return (
    <div className={wrapClass}>
      {!embedMode && <BillingGate stopReason={stopReason} paywallNote={paywallNote} remainingFree={remainingFree} />}

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
          embedMode={embedMode}
        />
      </div>

      {recommendations.length > 0 && (
        <div className="mt-4">
          <div className="mb-2">
            <h3 className="text-xs font-semibold text-gray-700">今回のおすすめ</h3>

            {embedMode && lastQueryView && (
              <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                条件：<span className="text-slate-700">{lastQueryView}</span>
              </div>
            )}

            {!embedMode && (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                気になる候補があれば「神社の詳細を見る」から確認できます。条件を足したい場合は、続けて入力してください。
              </p>
            )}
          </div>

          <section className="space-y-3">
            {recommendations.slice(0, 3).map((rec, idx) => (
              <RecommendationUnit key={rec.id ?? rec.place_id ?? idx} rec={rec} index={idx} />
            ))}
          </section>

          <div className="mt-3 text-[11px] text-slate-600">
            気になる神社があれば「地図で見る」で場所を確認できます。
          </div>

          {!embedMode && (
            <>
              <div className="mt-2 text-[11px] text-slate-500">
                ほかも比較したい場合は、下の「他も見て選ぶ（地図）」から探せます。
              </div>

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
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
