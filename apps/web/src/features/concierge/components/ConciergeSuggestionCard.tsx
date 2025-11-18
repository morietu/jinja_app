// apps/web/src/features/concierge/components/ConciergeSuggestionCard.tsx
import type { ConciergeRecommendation } from "../types";

type Props = {
  recommendation: ConciergeRecommendation;
  index: number;
  onShowMap?: (rec: ConciergeRecommendation) => void;
};

export function ConciergeSuggestionCard({ recommendation, index, onShowMap }: Props) {
  return (
    <div className="border rounded-xl p-3 text-xs flex flex-col gap-2 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-gray-400">候補 {index + 1}</div>
      </div>

      <div className="font-semibold text-sm">{recommendation.name}</div>

      <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">{recommendation.reason}</p>

      {onShowMap && (
        <button
          type="button"
          onClick={() => onShowMap(recommendation)}
          className="mt-1 inline-flex items-center justify-center px-3 py-2 rounded-full border text-[11px] hover:bg-gray-50 active:bg-gray-100"
        >
          Googleマップで見る
        </button>
      )}
    </div>
  );
}
