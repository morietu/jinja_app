// apps/web/src/lib/api/concierge/normalize.ts
import type { ConciergeRecommendation } from "./types";

export function normalizeRecommendations(input: unknown): ConciergeRecommendation[] {
  const list = Array.isArray(input) ? input : [];
  return list
    .filter((x): x is Record<string, any> => !!x && typeof x === "object")
    .map((r) => {
      const name = (r.display_name || r.name || "").toString().trim() || "（名称不明）";

      // display_address 優先、なければ location(string) を拾う
      const loc = r.location;
      const display_address =
        (r.display_address ?? null) || (typeof loc === "string" && loc.trim() ? loc.trim() : null) || null;

      const reason = typeof r.reason === "string" ? r.reason.trim() : r.reason == null ? null : String(r.reason).trim();

      return {
        ...r,
        name,
        display_name: r.display_name || name,
        display_address,
        reason, // ✅ null を残す
        __dummy: r.__dummy === true,
      } as ConciergeRecommendation;
    });
}
