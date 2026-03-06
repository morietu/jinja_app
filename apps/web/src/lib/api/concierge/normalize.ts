// apps/web/src/lib/api/concierge/normalize.ts
import type { ConciergeRecommendation } from "./types";

function toTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t ? t : null;
}

function pickReason(r: Record<string, any>): string | null {
  const exp = r.explanation;
  const expReason0 = Array.isArray(exp?.reasons) ? exp.reasons[0] : null;

  return (
    toTrimmedString(r.reason) ??
    toTrimmedString(r.one_liner) ??
    toTrimmedString(expReason0?.text) ??
    toTrimmedString(exp?.summary) ??
    (Array.isArray(r.bullets) ? toTrimmedString(r.bullets[0]) : null) ??
    null
  );
}

export function normalizeRecommendations(input: unknown): ConciergeRecommendation[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((x): x is Record<string, any> => x != null && typeof x === "object")
    .map((r) => {
      const nameRaw = (r.display_name ?? r.name ?? "").toString().trim();
      const name = nameRaw || "（名称不明）";

      const loc = typeof r.location === "string" ? r.location.trim() : "";
      const display_address = (r.display_address ?? null) || (loc ? loc : null);

      const reason = pickReason(r);

      return {
        ...r,
        name,
        display_name: (r.display_name ?? "").toString().trim() || name,
        display_address,
        reason,
        is_dummy: r.is_dummy === true || r.__dummy === true,
        __dummy: r.__dummy === true,
      } as ConciergeRecommendation;
    });
}
