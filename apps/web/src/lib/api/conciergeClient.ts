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
  const needTags = Array.isArray((u as any)?.data?._need?.tags) ? ((u as any).data._need.tags as string[]) : [];

  return {
    ok: !!u?.ok,
    data: {
      _need: { tags: needTags }, // ✅ これを足す
      recommendations: recs.map((r: any) => ({
        name: r?.name ?? r?.display_name ?? "",
        display_name: r?.display_name ?? null,
        reason: r?.reason ?? null,
        bullets: Array.isArray(r?.bullets) ? r.bullets : null,
        explanation: r?.explanation ?? null,
        location: r?.display_address ?? r?.location ?? r?.address ?? null,
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

  const raw = await postConciergeChat({ query: text });
  const payload = raw && typeof raw === "object" && "data" in (raw as any) ? (raw as any).data : raw;

  const recs = normalizeRecommendations(payload?.data?.recommendations ?? payload?.recommendations);

  const ok = payload?.ok !== false && recs.length > 0; // ✅ここがポイント

  const unified: UnifiedConciergeResponse = {
    ok,
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
