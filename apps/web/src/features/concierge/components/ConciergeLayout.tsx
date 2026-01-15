// apps/web/src/features/concierge/components/ConciergeLayout.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatPanel from "./ChatPanel";

import type { ConciergeRecommendation, ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason } from "@/features/concierge/types/unified";

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
  needTags?: string[];
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
  needTags = [],
  paywallNote = null,
  remainingFree = null,
  stopReason,
  canSend,
  embedMode = false,
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

  // ✅ 非embed: 幅も高さも100%（max-w を消す）
  const wrapClass = embedMode ? "w-full flex flex-col" : "w-full h-dvh flex flex-col";

  return (
    <div className={wrapClass}>
      {!embedMode && (
        <div className="px-3 pt-3">
          <BillingGate stopReason={stopReason} paywallNote={paywallNote} remainingFree={remainingFree} />
        </div>
      )}

      {/* ✅ min-h-0 を付けて、子のoverflowが効くようにする */}
      <div className="flex-1 min-h-0 px-3 pb-3">
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
          recommendations={recommendations}
          needTags={needTags}
          onNewThread={onNewThread}
        />
      </div>
    </div>
  );
}
