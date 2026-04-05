type RecommendationMeta = {
  rankTitle?: string | null;
  rankBody?: string | null;
  rankComparison?: {
    is_top?: boolean;
    gap_from_top?: number;
  } | null;
};

type Props = {
  recommendationMeta?: RecommendationMeta | null;
};

export function RecommendationMetaSection({ recommendationMeta }: Props) {
  const title = recommendationMeta?.rankTitle;
  const body = recommendationMeta?.rankBody;
  const isTop = Boolean(recommendationMeta?.rankComparison?.is_top);
  const gap = recommendationMeta?.rankComparison?.gap_from_top;

  if (!title || !body) return null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <p className="text-sm leading-6 text-neutral-700">{body}</p>

        {!isTop && typeof gap === "number" && gap > 0 && (
          <p className="text-xs text-neutral-500">1位との差: {gap.toFixed(2)}</p>
        )}
      </div>
    </section>
  );
}
