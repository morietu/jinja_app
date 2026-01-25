// apps/web/src/lib/concierge/pickBreakdownFromThread.ts
import type { ConciergeBreakdown } from "@/lib/api/concierge";

type RecLike = {
  shrine?: { id?: number };
  shrine_id?: number;
  shrineId?: number;
  breakdown?: unknown;
  reason_breakdown?: unknown;
};

type ConciergeThreadLike = {
  recommendations?: RecLike[];
  recommendations_v2?: RecLike[];
};

/**
 * Concierge thread から shrineId に一致する breakdown を拾う
 */
export function pickBreakdownFromThread(thread: unknown, shrineId: number): ConciergeBreakdown | null {
  const t = thread as ConciergeThreadLike;
  const recs = t.recommendations ?? t.recommendations_v2 ?? [];
  const hit = recs.find((r) => Number(r?.shrine?.id ?? r?.shrine_id ?? r?.shrineId) === shrineId);
  return (hit?.breakdown ?? hit?.reason_breakdown ?? null) as ConciergeBreakdown | null;
}
