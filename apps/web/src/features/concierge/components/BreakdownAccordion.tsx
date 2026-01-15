"use client";

import type { ConciergeBreakdown } from "@/lib/api/concierge";

type Props = {
  breakdown?: ConciergeBreakdown;
};

function fmt(n: number | undefined, digits = 2) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toFixed(digits);
}

export default function BreakdownAccordion({ breakdown }: Props) {
  if (!breakdown) return null;

  return (
    <details className="mt-2 rounded-xl border border-neutral-200 bg-white p-3">
      <summary className="cursor-pointer text-sm text-neutral-700">
        根拠を見る（合計: {fmt(breakdown.score_total, 2)}）
      </summary>

      <div className="mt-2 space-y-2 text-xs text-neutral-700">
        <div className="grid grid-cols-2 gap-2">
          <div>element: {breakdown.score_element}</div>
          <div>need: {breakdown.score_need}</div>
          <div>popular: {fmt(breakdown.score_popular, 2)}</div>
          <div>total: {fmt(breakdown.score_total, 2)}</div>
        </div>

        <div className="text-neutral-500">
          weights: element {fmt(breakdown.weights?.element, 2)} / need {fmt(breakdown.weights?.need, 2)} / popular{" "}
          {fmt(breakdown.weights?.popular, 2)}
        </div>
      </div>
    </details>
  );
}
