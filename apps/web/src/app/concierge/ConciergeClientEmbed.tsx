"use client";

import { useMemo, useState } from "react";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";

export default function ConciergeClientEmbed() {
  const [lastUnified, setLastUnified] = useState<UnifiedConciergeResponse | null>(null);

  const { send, sending, error } = useConciergeChat(null, {
    onUnified: (u) => setLastUnified(u),
  });

  const recommendations = useMemo(() => {
    const recs = lastUnified?.data?.recommendations;
    return Array.isArray(recs) ? recs : [];
  }, [lastUnified]);

  const stopReason: StopReason = lastUnified?.stop_reason ?? null;
  const canSend = stopReason === null;

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!canSend) return;

    void send(trimmed).catch((e) => {
      if (process.env.NODE_ENV !== "production") console.error("[embed] send failed", e);
    });
  };

  const messages: ConciergeMessage[] = []; // embedはログを持たない

  return (
    <ConciergeLayout
      thread={null}
      messages={messages}
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
    />
  );
}
