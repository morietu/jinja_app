import { postConciergeChat } from "@/lib/api/concierge";
import type { ConciergeResponse } from "@/viewmodels/conciergeToShrineList";
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import { normalizeRecommendations } from "@/lib/api/concierge/normalize";

export type ConciergeRequest = {
  text: string;
  birthdate?: string;
  mode?: "need" | "compat";
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
        _signals: r?._signals ?? null,
        _astro: r?._astro ?? null,
      })),
    },
  };
}

export async function searchConcierge(req: ConciergeRequest): Promise<ConciergeResponse> {
  const text = req.text?.trim() ?? "";
  const birthdate = req.birthdate?.trim();

  const requestPayload =
    req.mode === "compat" && birthdate
      ? {
          version: 1,
          mode: "compat" as const,
          query: "",
          filters: { birthdate },
          birthdate,
        }
      : {
          query: text,
        };

  const raw = await postConciergeChat(requestPayload);

  const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const responsePayload = rawObj && "data" in rawObj ? rawObj.data : raw;

  const payloadData =
    responsePayload && typeof responsePayload === "object" && !Array.isArray(responsePayload)
      ? (responsePayload as Record<string, unknown>).data &&
        typeof (responsePayload as Record<string, unknown>).data === "object" &&
        !Array.isArray((responsePayload as Record<string, unknown>).data)
        ? ((responsePayload as Record<string, unknown>).data as Record<string, unknown>)
        : (responsePayload as Record<string, unknown>)
      : {};

  console.log("SEARCH_CONCIERGE_REQUEST_PAYLOAD", requestPayload);
  console.log("SEARCH_CONCIERGE_RAW", raw);
  console.log("SEARCH_CONCIERGE_PAYLOAD_DATA", payloadData);
  
  const recs = normalizeRecommendations(payloadData.recommendations);

  const rawRecommendations = Array.isArray(payloadData.recommendations) ? payloadData.recommendations : [];

  console.log(
    "SEARCH_CONCIERGE_RAW_RECS",
    rawRecommendations.map((r: any) => ({
      name: r?.display_name ?? r?.name,
      scoreElement: r?.breakdown?.score_element ?? null,
      recAstro: r?._signals?.astro ?? r?._astro ?? null,
      keys: Object.keys(r ?? {}),
    })),
  );

  const ok = (responsePayload as any)?.ok !== false;

  const unified: UnifiedConciergeResponse = {
    ok,
    stop_reason: (responsePayload as any)?.stop_reason ?? null,
    note: (responsePayload as any)?.note ?? null,
    reply:
      typeof ((responsePayload as any)?.reply ?? payloadData.reply) === "string"
        ? (((responsePayload as any)?.reply ?? payloadData.reply) as string)
        : null,
    remaining_free:
      typeof (responsePayload as any)?.remaining_free === "number" ? (responsePayload as any).remaining_free : null,
    thread: (responsePayload as any)?.thread ?? null,
    data: {
      ...payloadData,
      recommendations: recs,
    },
  };

  const response = unifiedToConciergeResponse(unified);
  console.log("UNIFIED_TO_CONCIERGE_RESPONSE", response);

  return response;
}
