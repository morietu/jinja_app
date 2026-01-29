import { buildOneLiner } from "@/lib/concierge/pickAClause";
import { buildConciergeHint } from "@/components/concierge/ConciergeBreakdownBody";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { SignalLevel } from "@/lib/shrine/buildShrineExplanation";

export function buildShrineJudge(
  exp: { hasSignal: boolean; summary: string; strongHint?: string; signalLevel: SignalLevel },
  concierge: ConciergeBreakdown | null,
) {
  const use = concierge !== null;
  return {
    title: use ? "おすすめ理由" : exp.hasSignal ? "判断材料" : "目安",
    level: use ? "strong" : exp.signalLevel,
    summary: use ? buildOneLiner(concierge!) : exp.summary,
    hint: use ? buildConciergeHint(concierge!) : exp.strongHint,
  };
}
