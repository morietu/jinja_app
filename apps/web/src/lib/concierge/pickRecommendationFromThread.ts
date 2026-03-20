import { serverLog } from "@/lib/server/logging";
import type { ConciergeRecommendation, ConciergeThreadDetail } from "@/lib/api/concierge/types";

export function pickRecommendationFromThread(
  thread: ConciergeThreadDetail,
  shrineId: number,
): ConciergeRecommendation | null {
  const messages = Array.isArray((thread as any)?.messages) ? (thread as any).messages : [];

  serverLog("warn", "PICK_REC_FROM_THREAD_START", {
    shrineId,
    messageCount: messages.length,
  });

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i] as any;
    const recs = msg?.payload?.data?.recommendations ?? msg?.data?.recommendations ?? null;

    serverLog("warn", "PICK_REC_FROM_THREAD_SCAN", {
      shrineId,
      index: i,
      hasPayloadData: !!msg?.payload?.data,
      hasDataRecs: Array.isArray(msg?.data?.recommendations),
      hasPayloadDataRecs: Array.isArray(msg?.payload?.data?.recommendations),
      recCount: Array.isArray(recs) ? recs.length : 0,
      recShrineIds: Array.isArray(recs) ? recs.map((r: any) => r?.shrine_id ?? r?.shrine?.id ?? null) : [],
    });

    if (!Array.isArray(recs)) continue;

    const hit = recs.find((r: any) => {
      const id = r?.shrine_id ?? r?.shrine?.id ?? null;
      return Number(id) === shrineId;
    });

    if (hit) {
      serverLog("warn", "PICK_REC_FROM_THREAD_HIT", {
        shrineId,
        hitShrineId: hit?.shrine_id ?? hit?.shrine?.id ?? null,
        hasExplanation: !!(hit?.explanation && typeof hit.explanation === "object"),
        explanationSummary:
          hit?.explanation && typeof hit.explanation === "object" ? (hit.explanation.summary ?? null) : null,
      });
      return hit as ConciergeRecommendation;
    }
  }

  serverLog("warn", "PICK_REC_FROM_THREAD_MISS", {
    shrineId,
  });

  return null;
}
