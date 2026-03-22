// apps/web/src/lib/concierge/pickReasonFromThread.ts
type RecLike = {
  shrine?: { id?: number };
  shrine_id?: number;
  shrineId?: number;
  id?: number;
  reason?: unknown;
};

type ConciergeThreadLike = {
  recommendations?: RecLike[];
  recommendations_v2?: RecLike[];
};

export function pickReasonFromThread(thread: unknown, shrineId: number): string | null {
  const t = thread as ConciergeThreadLike;
  const recs = t.recommendations ?? t.recommendations_v2 ?? [];

  const hit = recs.find((r) => {
    const id = Number(r?.shrine?.id ?? r?.shrine_id ?? r?.shrineId ?? r?.id);
    return Number.isFinite(id) && id === shrineId;
  });

  const reason = hit?.reason;
  return typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : null;
}
