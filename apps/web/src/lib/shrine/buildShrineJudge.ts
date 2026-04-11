import { buildOneLiner } from "@/lib/concierge/pickAClause";
import { buildConciergeHint } from "@/lib/concierge/breakdownText";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { ShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

export function buildShrineJudge(exp: ShrineExplanation, concierge: ConciergeBreakdown | null) {
  const use = concierge !== null;
  return {
    title: use ? "おすすめ理由" : "判断材料",
    level: use ? "strong" : "mid",
    summary: use ? buildOneLiner(concierge!) : exp.reason,
    hint: use ? buildConciergeHint(concierge!) : exp.supplement,
  };
}
