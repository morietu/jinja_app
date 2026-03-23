// apps/web/src/lib/concierge/pickExplanationPayloadFromThread.ts

type ExplanationPrimaryReason = {
  type?: string | null;
  label?: string | null;
  label_ja?: string | null;
  evidence?: string[] | null;
  score?: number | null;
  is_primary?: boolean | null;
};

export type PickedExplanationPayload = {
  primary_need_tag?: string | null;
  primary_need_label_ja?: string | null;
  primary_reason?: ExplanationPrimaryReason | null;
  secondary_reasons?: ExplanationPrimaryReason[] | null;
  original_reason?: string | null;
  score?: {
    element?: number | null;
    need?: number | null;
    total?: number | null;
    total_ranked?: number | null;
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.filter((v): v is string => typeof v === "string");
  return out.length ? out : [];
}

function normalizePrimaryReason(value: unknown): ExplanationPrimaryReason | null {
  if (!isRecord(value)) return null;

  return {
    type: typeof value.type === "string" ? value.type : null,
    label: typeof value.label === "string" ? value.label : null,
    label_ja: typeof value.label_ja === "string" ? value.label_ja : null,
    evidence: toStringArray(value.evidence),
    score: typeof value.score === "number" ? value.score : null,
    is_primary: typeof value.is_primary === "boolean" ? value.is_primary : null,
  };
}

function normalizeSecondaryReasons(value: unknown): ExplanationPrimaryReason[] | null {
  if (!Array.isArray(value)) return null;

  const out = value
    .map((item) => normalizePrimaryReason(item))
    .filter((item): item is ExplanationPrimaryReason => item !== null);

  return out;
}

/**
 * Concierge thread から shrineId に一致する _explanation_payload を拾う
 */
export function pickExplanationPayloadFromThread(thread: unknown, shrineId: number): PickedExplanationPayload | null {
  if (!isRecord(thread)) return null;

  const data = isRecord(thread.data) ? thread.data : null;
  const recs = Array.isArray(data?.recommendations) ? data!.recommendations : [];

  const hit = recs.find((item) => {
    if (!isRecord(item)) return false;
    return Number(item.shrine_id) === shrineId;
  });

  if (!isRecord(hit)) return null;

  const payload = isRecord(hit._explanation_payload) ? hit._explanation_payload : null;
  if (!payload) return null;

  const score = isRecord(payload.score) ? payload.score : null;

  return {
    primary_need_tag: typeof payload.primary_need_tag === "string" ? payload.primary_need_tag : null,
    primary_need_label_ja: typeof payload.primary_need_label_ja === "string" ? payload.primary_need_label_ja : null,
    primary_reason: normalizePrimaryReason(payload.primary_reason),
    secondary_reasons: normalizeSecondaryReasons(payload.secondary_reasons),
    original_reason: typeof payload.original_reason === "string" ? payload.original_reason : null,
    score: score
      ? {
          element: typeof score.element === "number" ? score.element : null,
          need: typeof score.need === "number" ? score.need : null,
          total: typeof score.total === "number" ? score.total : null,
          total_ranked: typeof score.total_ranked === "number" ? score.total_ranked : null,
        }
      : null,
  };
}
