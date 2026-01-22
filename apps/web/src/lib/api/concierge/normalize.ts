// apps/web/src/lib/api/concierge/normalize.ts
import type { ConciergeRecommendation } from "./types";

export function normalizeRecommendations(input: unknown): ConciergeRecommendation[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((x): x is Record<string, any> => x != null && typeof x === "object")
    .map((r) => {
      const nameRaw = (r.display_name ?? r.name ?? "").toString().trim();
      const name = nameRaw || "（名称不明）";

      const loc = typeof r.location === "string" ? r.location.trim() : "";
      const display_address = (r.display_address ?? null) || (loc ? loc : null);

      const reason = typeof r.reason === "string" ? r.reason.trim() : r.reason == null ? null : String(r.reason).trim();

      return {
        ...r,
        name,
        display_name: (r.display_name ?? "").toString().trim() || name,
        display_address,
        reason,
        __dummy: r.__dummy === true,
      } as ConciergeRecommendation;
    });
}
