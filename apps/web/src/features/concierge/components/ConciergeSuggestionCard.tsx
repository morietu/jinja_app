// src/features/concierge/components/ConciergeSuggestionCard.tsx
import type { ConciergeRecommendation } from "../types";

type Props = {
  recommendation: ConciergeRecommendation;
  index: number;
  // 後でマップ連携するためのコールバック
  onShowMap?: (rec: ConciergeRecommendation) => void;
};

export function ConciergeSuggestionCard({ recommendation, index, onShowMap }: Props) {
  return (
    <div className="border rounded-lg p-3 text-xs flex flex-col gap-1 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-gray-400">候補 {index + 1}</div>
      </div>
      <div className="font-semibold text-sm">{recommendation.name}</div>
      <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line">{recommendation.reason}</p>

      {onShowMap && (
        <button
          type="button"
          onClick={() => onShowMap(recommendation)}
          className="mt-1 self-start px-2 py-1 rounded border text-[11px] hover:bg-gray-50"
        >
          地図で見る
        </button>
      )}
    </div>
  );
}
