// src/features/concierge/components/ConciergeSuggestionsPanel.tsx
import type { ConciergeRecommendation } from "../types";
import { ConciergeSuggestionCard } from "./ConciergeSuggestionCard";

type Props = {
  recommendations: ConciergeRecommendation[];
  onShowMap?: (rec: ConciergeRecommendation) => void;
};

export function ConciergeSuggestionsPanel({ recommendations, onShowMap }: Props) {
  if (!recommendations.length) {
    return null;
  }

  return (
    <div className="text-xs border rounded-lg p-2 bg-gray-50 space-y-2">
      <p className="font-semibold mb-1 text-[11px]">候補の神社</p>
      <div className="grid gap-2">
        {recommendations.map((r, idx) => (
          <ConciergeSuggestionCard key={r.name ?? idx} recommendation={r} index={idx} onShowMap={onShowMap} />
        ))}
      </div>
    </div>
  );
}
