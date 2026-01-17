import type { ConciergeSection } from "./types";
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";

export function buildSectionsFromUnified(unified: UnifiedConciergeResponse | null): ConciergeSection[] {
  if (!unified) return [];

  const sections: ConciergeSection[] = [];

  // 1. サマリー（将来拡張用）
  if (typeof unified.summary === "string" && unified.summary.trim()) {
    sections.push({
      type: "summary",
      text: unified.summary,
    });
  }

  // 2. レコメンド（今の主役）
  const recs = unified.data?.recommendations ?? [];
  if (recs.length > 0) {
    sections.push({
      type: "recommendations",
      items: recs,
      primaryIndex: 0,
      needTags: unified.data?.need?.tags ?? [],
    });
  }

  // 3. fallback
  if (sections.length === 0) {
    sections.push({
      type: "dev",
      raw: unified,
    });
  }

  return sections;
}
