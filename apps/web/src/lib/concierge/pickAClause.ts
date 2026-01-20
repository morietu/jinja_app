// apps/web/src/lib/concierge/pickAClause.ts
import type { ConciergeBreakdown } from "@/lib/api/concierge";

export function pickAClause(b?: ConciergeBreakdown | null): string {
  if (!b) {
    return "少し立ち止まって考えたい人には";
  }

  const w = b.weights ?? { element: 0, need: 0, popular: 0 };

  const contrib = {
    need: (Number(b.score_need) || 0) * (Number(w.need) || 0),
    element: (Number(b.score_element) || 0) * (Number(w.element) || 0),
  } as const;

  if (contrib.need > contrib.element && contrib.need > 0) {
    return "今の願いや条件を整理したい人には";
  }

  if (contrib.element > 0) {
    return "雰囲気や相性を大切にしたい人には";
  }

  return "少し立ち止まって考えたい人には";
}

export function buildDescription(b?: ConciergeBreakdown | null): string {
  const A = pickAClause(b);
  return [
    `${A}、選択肢として検討しやすい神社です。`,
    "判断を急がず、状況を整理するための参拝として使われることがあります。",
    "今の状態に合うかどうかを基準に判断するのが自然です。",
  ].join("\n");
}

export function buildOneLiner(b?: ConciergeBreakdown | null): string {
  const A = pickAClause(b);
  return `${A}、選択肢として検討しやすい神社です。`;
}
