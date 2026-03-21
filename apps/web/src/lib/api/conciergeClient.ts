import { postConciergeChat } from "@/lib/api/concierge";
import type { ConciergeResponse } from "@/viewmodels/conciergeToShrineList";
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import { normalizeRecommendations } from "@/lib/api/concierge/normalize";

export type ConciergeRequest = {
  text: string;
};

type ConciergeDataLike = {
  _need?: { tags?: string[] };
  _signals?: Record<string, unknown> | null;
  message?: string | null;
  recommendations?: unknown[];
};

function unifiedToConciergeResponse(u: UnifiedConciergeResponse): ConciergeResponse {
  const data: ConciergeDataLike =
    u?.data && typeof u.data === "object" && !Array.isArray(u.data) ? (u.data as ConciergeDataLike) : {};

  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  const needTags = Array.isArray(data._need?.tags) ? data._need.tags : [];

  return {
    ok: !!u?.ok,
    remaining_free: typeof u?.remaining_free === "number" ? u.remaining_free : null,
    data: {
      _need: { tags: needTags },
      _signals: data._signals ?? null,
      message: typeof data.message === "string" ? data.message : null,
      recommendations: recs.map((r: any) => ({
        name: r?.name ?? r?.display_name ?? "",
        display_name: r?.display_name ?? null,
        reason: r?.reason ?? null,
        reason_source: r?.reason_source ?? null,
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
  const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const payload = rawObj && "data" in rawObj ? rawObj.data : raw;

  const payloadData =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).data &&
        typeof (payload as Record<string, unknown>).data === "object" &&
        !Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as Record<string, unknown>)
        : (payload as Record<string, unknown>)
      : {};

  const recs = normalizeRecommendations(payloadData.recommendations);

  const ok = (payload as any)?.ok !== false;

  const unified: UnifiedConciergeResponse = {
    ok,
    stop_reason: (payload as any)?.stop_reason ?? null,
    note: (payload as any)?.note ?? null,
    reply:
      typeof ((payload as any)?.reply ?? payloadData.reply) === "string"
        ? (((payload as any)?.reply ?? payloadData.reply) as string)
        : null,
    remaining_free: typeof (payload as any)?.remaining_free === "number" ? (payload as any).remaining_free : null,
    thread: (payload as any)?.thread ?? null,
    data: {
      ...payloadData,
      recommendations: recs,
    },
  };

  return unifiedToConciergeResponse(unified);
}
