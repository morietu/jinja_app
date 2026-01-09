// apps/web/src/app/concierge/ConciergeClientEmbed.tsx
"use client";

import { useMemo, useState } from "react";
import { useConciergeChat } from "@/features/concierge/hooks";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ConciergeRecommendation } from "@/lib/api/concierge";

function seedUnified(): UnifiedConciergeResponse {
  const seedRec: ConciergeRecommendation = {
    // 既存UIが参照するキーだけ埋める（型が厳しければ as any でOK）
    name: "近隣の神社",
    display_name: "近隣の神社",
    reason: "まずは近くで、落ち着いて手を合わせられる場所から。",
    bullets: ["落ち着いて参拝しやすい", "移動が少なく続けやすい", "気分転換の入口にしやすい"],
    display_address: "東京駅周辺",
    location: { lat: 35.6812, lng: 139.7671 },
    __dummy: true as any, // 既存のベータ表示ロジックがあるなら活かす
  } as any;

  return {
    ok: true,
    data: { recommendations: [seedRec] } as any,
    stop_reason: null,
    remaining_free: null,
    note: null,
    reply: null,
    thread: null,
    intent: null,
  } as any;
}

export default function ConciergeClientEmbed() {
  // ✅ 初期はseedを入れて「2枚目状態」から開始
  const [lastUnified, setLastUnified] = useState<UnifiedConciergeResponse>(() => seedUnified());
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  const { send, sending, error } = useConciergeChat(null, {
    onUnified: (u) => {
      setLastUnified(u);
      // 直近の入力（条件）を1行残す用：replyじゃなく入力を残したいので別管理
      // → handleSendで setLastQuery するのが一番ブレない
    },
  });

  const recommendations = useMemo(() => {
    const recs = lastUnified?.data?.recommendations;
    return Array.isArray(recs) ? recs : [];
  }, [lastUnified]);

  const stopReason: StopReason = (lastUnified?.stop_reason ?? null) as any;
  const canSend = stopReason === null;

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!canSend) return;

    setLastQuery(trimmed); // ✅ “直近の入力（条件）”を保持
    void send(trimmed).catch((e) => {
      if (process.env.NODE_ENV !== "production") console.error("[embed] send failed", e);
    });
  };

  return (
    <ConciergeLayout
      thread={null}
      messages={[]} // embedは会話ログを持たない
      sending={sending}
      error={error}
      onSend={handleSend}
      onRetry={() => {}}
      recommendations={recommendations}
      paywallNote={lastUnified?.note ?? null}
      remainingFree={lastUnified?.remaining_free ?? null}
      stopReason={stopReason}
      canSend={canSend}
      embedMode
      lastQuery={lastQuery} // ✅ 条件：〇〇 の1行表示に使う
    />
  );
}
