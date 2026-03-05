// apps/web/src/lib/api/conciergeClient.ts
import { postConciergeChat } from "@/lib/api/concierge";
import type { ConciergeResponse } from "@/viewmodels/conciergeToShrineList";
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import { normalizeRecommendations } from "@/lib/api/concierge/normalize";

export type ConciergeRequest = {
  text: string;
};

function unifiedToConciergeResponse(u: UnifiedConciergeResponse): ConciergeResponse {
  const recs = Array.isArray(u?.data?.recommendations) ? u.data.recommendations : [];

  // ConciergeResponse の最低限に落とす（viewmodelが読むのはここだけ）
  return {
    ok: !!u?.ok,
    data: {
      recommendations: recs.map((r: any) => ({
        name: r?.name ?? r?.display_name ?? "",
        display_name: r?.display_name ?? null,
        reason: r?.reason ?? r?.one_liner ?? null, // ← 無ければそれっぽい要約に逃がす
        location: r?.location ?? r?.address ?? null,
        lat: r?.lat ?? null,
        lng: r?.lng ?? null,
        distance_m: r?.distance_m ?? null,
        place_id: r?.place_id ?? null,
        shrine_id: r?.shrine_id ?? null,
        popular_score: r?.popular_score ?? null,
        breakdown: r?.breakdown ?? null,
      })),
    },
  };
}

export async function searchConcierge(req: ConciergeRequest): Promise<ConciergeResponse> {
  const text = req.text?.trim();
  if (!text) return { ok: false };

  // ✅ 既存の /concierge/chat と同じ流れで叩く
  const raw = await postConciergeChat({ query: text });

  // axiosレスポンス/生payload 両対応（useConciergeChatと揃える）
  const payload = raw && typeof raw === "object" && "data" in (raw as any) ? (raw as any).data : raw;

  const recs = normalizeRecommendations(payload?.data?.recommendations ?? payload?.recommendations);
  const unified: UnifiedConciergeResponse = {
    ok: payload?.ok === false ? false : true,
    stop_reason: payload?.stop_reason ?? null,
    note: payload?.note ?? null,
    reply: typeof (payload?.reply ?? payload?.data?.reply) === "string" ? (payload.reply ?? payload.data.reply) : null,
    remaining_free: typeof payload?.remaining_free === "number" ? payload.remaining_free : null,
    thread: payload?.thread ?? null,
    data: {
      ...(payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : {}),
      recommendations: recs,
    },
  };

  return unifiedToConciergeResponse(unified);
}
