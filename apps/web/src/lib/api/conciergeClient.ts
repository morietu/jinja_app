// apps/web/src/lib/api/conciergeClient.ts
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
  const threadId = typeof u.thread_id === "string" && u.thread_id.trim() ? u.thread_id.trim() : null;

  return {
    ok: !!u?.ok,
    remaining_free: typeof u?.remaining_free === "number" ? u.remaining_free : null,
    limit: typeof u?.limit === "number" ? u.limit : null,
    reply: typeof u?.reply === "string" ? u.reply : null,
    thread_id: threadId,
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
        _explanation_payload: r?._explanation_payload ?? null,
        address: r?.address ?? null,
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

  const raw = await postConciergeChat({ query: text });
  const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;

  const rawData =
    rawObj?.data && typeof rawObj.data === "object" && !Array.isArray(rawObj.data)
      ? (rawObj.data as Record<string, unknown>)
      : {};

  const threadObj =
    rawObj?.thread && typeof rawObj.thread === "object" && !Array.isArray(rawObj.thread)
      ? (rawObj.thread as Record<string, unknown>)
      : null;

  const threadObjId = threadObj?.["id"];

  const threadId =
    (typeof rawObj?.thread_id === "string" && rawObj.thread_id.trim()) ||
    (typeof threadObjId === "number" && String(threadObjId)) ||
    null;

  const recs = normalizeRecommendations(rawData.recommendations);

  const unified: UnifiedConciergeResponse = {
    ok: rawObj?.ok !== false,
    stop_reason: (rawObj?.stop_reason as any) ?? null,
    note: typeof rawObj?.note === "string" ? rawObj.note : null,
    reply: typeof rawObj?.reply === "string" ? rawObj.reply : null,
    remaining_free: typeof rawObj?.remaining_free === "number" ? rawObj.remaining_free : null,
    limit: typeof rawObj?.limit === "number" ? rawObj.limit : null,
    thread_id: threadId,
    thread: (rawObj?.thread as any) ?? null,
    data: {
      ...rawData,
      recommendations: recs,
    },
  };

  return unifiedToConciergeResponse(unified);
}
