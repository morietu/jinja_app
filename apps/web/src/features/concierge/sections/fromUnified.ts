// apps/web/src/features/concierge/sections/fromUnified.ts
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import type { ConciergeSection } from "@/features/concierge/types/sections";

/**
 * UnifiedConciergeResponse から sections を作る（最小）
 * - summary 等の未定義フィールドは参照しない
 * - need は data._need を参照する
 */
export function sectionsFromUnified(unified: UnifiedConciergeResponse | null): ConciergeSection[] {
  if (!unified?.ok) return [];

  const recs = ((unified.data as any)?.recommendations ?? []) as ConciergeRecommendation[];
  const needTags = (((unified.data as any)?._need?.tags ?? []) as unknown[]).filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  );

  if (!Array.isArray(recs) || recs.length === 0) return [];

  // 最小：primary 1セクションだけ（3件まで）
  return [
    {
      kind: "primary",
      title: "おすすめ",
      items: recs.slice(0, 3),
      needTags,
    },
  ];
}
