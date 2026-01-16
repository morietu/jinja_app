// apps/web/src/app/concierge/ConciergeClientEmbed.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import ChatPanel from "@/features/concierge/components/ChatPanel";

const SEED_QUERY = "明治神宮";

// 2枚目を「初回レンダーから」出すための暫定rec（最低限の形）
function buildFallbackRec(): ConciergeRecommendation {
  return {
    name: SEED_QUERY,
    display_name: SEED_QUERY,
    reason: "まずは代表的な候補を表示しています。条件を追加して絞れます。",
    display_address: null,
    location: null,
  } as any;
}

function buildSeedUnified(rec: ConciergeRecommendation): UnifiedConciergeResponse {
  return {
    ok: true,
    data: { recommendations: [rec] } as any,
    reply: null,
    stop_reason: null,
    note: null,
    remaining_free: null,
    thread: null,
  } as any;
}

export default function ConciergeClientEmbed() {
  // ✅ 初回から2枚目にする：lastUnified を seed入りで初期化
  const [lastUnified, setLastUnified] = useState<UnifiedConciergeResponse>(() => buildSeedUnified(buildFallbackRec()));
  const [lastQuery, setLastQuery] = useState<string>(SEED_QUERY);

  const { send, sending, error } = useConciergeChat(null, {
    onUnified: (u) => setLastUnified(u),
  });

  // ✅ 初回seed：Placesで place_id/lat/lng/address を埋めて上書き（失敗してもUI維持）
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/places/find", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: SEED_QUERY }),
          cache: "no-store",
        });

        if (!res.ok) return;
        const json = await res.json();

        // API差異に耐える “雑取り”
        const cand = (json?.candidates?.[0] ??
          json?.data?.candidates?.[0] ??
          json?.result?.candidates?.[0] ??
          json?.results?.[0] ??
          null) as any;

        if (!cand) return;

        const placeId = cand.place_id ?? cand.placeId ?? cand.google_place_id ?? null;
        const addr = cand.formatted_address ?? cand.formattedAddress ?? cand.address ?? null;

        const loc = cand.geometry?.location ?? cand.location ?? null;
        const lat = loc?.lat ?? cand.lat ?? null;
        const lng = loc?.lng ?? cand.lng ?? null;

        const nextRec: ConciergeRecommendation = {
          ...buildFallbackRec(),
          name: cand.name ?? SEED_QUERY,
          display_name: cand.name ?? SEED_QUERY,
          ...(placeId ? { place_id: String(placeId) } : {}),
          ...(addr ? { display_address: String(addr) } : {}),
          ...(lat != null && lng != null ? { location: { lat: Number(lat), lng: Number(lng) } } : {}),
          reason: "まずは代表的な候補を表示しています。条件を追加して絞れます。",
        } as any;

        if (!alive) return;
        setLastUnified(buildSeedUnified(nextRec));
      } catch {
        // seed失敗でもOK：fallbackがあるのでUIは2枚目のまま
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const recommendations = useMemo(() => {
    const recs = lastUnified?.data?.recommendations;
    return Array.isArray(recs) ? recs : [];
  }, [lastUnified]);

  const stopReason: StopReason = lastUnified?.stop_reason ?? null;
  const canSend = stopReason === null;

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !canSend) return;
    setLastQuery(trimmed);
    void send(trimmed);
  };

  return (
    <ConciergeLayout
      
      messages={[]}
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
      lastQuery={lastQuery}
    />
  );
}
