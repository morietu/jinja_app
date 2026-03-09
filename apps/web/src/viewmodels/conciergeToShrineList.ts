import type { ShrineListItem } from "@/components/shrines/ShrineList";

/**
 * Conciergeのレスポンス型は、まずはfixtureに合わせて最低限で定義。
 * 後でopenapiから生成 or zod導入に差し替えればOK。
 */
export type ConciergeResponse = {
  ok: boolean;
  data?: {
    _need?: { tags?: string[] };
    _signals?: Record<string, unknown> | null;
    message?: string | null;
    recommendations?: Array<{
      name: string;
      display_name?: string | null;
      reason?: string | null;
      reason_source?: string | null;
      location?: string | null;
      lat?: number | null;
      lng?: number | null;
      distance_m?: number | null;
      place_id?: string | null;
      shrine_id?: number | null;
      popular_score?: number | null;
      bullets?: string[] | null;
      explanation?: {
        version?: number | null;
        summary?: string | null;
        reasons?: Array<{
          code?: string | null;
          label?: string | null;
          text?: string | null;
          strength?: "low" | "mid" | "high" | null;
          evidence?: Record<string, unknown> | null;
        }> | null;
        disclaimer?: string | null;
      } | null;
      breakdown?: {
        matched_need_tags?: string[] | null;
        score_total?: number | null;
      } | null;
    }>;
  };
};

const NEED_LABELS: Record<string, string> = {
  career: "転機・仕事",
  mental: "不安・心",
  love: "恋愛",
  money: "金運",
  rest: "休息",
};

function safeId(r: NonNullable<NonNullable<ConciergeResponse["data"]>["recommendations"]>[number]) {
  if (typeof r.shrine_id === "number") return `shrine_${r.shrine_id}`;
  if (r.place_id) return `place_${r.place_id}`;
  return `name_${encodeURIComponent(r.name)}`;
}

function normalizeTagList(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toDisplayTag(tag: string): string {
  return NEED_LABELS[tag] ?? tag;
}

/**
 * ここで「コンシェルジュ結果 → UI表示」へ変換する。
 * UIに渡す要素だけ作り、余計な情報は捨てる（後で必要になったら足す）。
 */
export function conciergeToShrineListItems(resp: ConciergeResponse): ShrineListItem[] {
  if (!resp?.ok) return [];

  const recs = resp.data?.recommendations ?? [];
  const fallbackTags = normalizeTagList(resp.data?._need?.tags);

  console.log(
    recs.map((r) => ({
      name: r.name,
      reasons: r.explanation?.reasons,
    }))
  );

  return recs.map((r, idx) => {
    const id = safeId(r);
    const name = r.display_name ?? r.name;

    const matchedTags = normalizeTagList(r.breakdown?.matched_need_tags);
    const rawTags = matchedTags.length ? matchedTags : fallbackTags;

    const tags = rawTags.map(toDisplayTag).slice(0, 5);
    const compatibilityLabels = matchedTags.map(toDisplayTag).slice(0, 2);

    const subReason = Array.isArray(r.bullets) && typeof r.bullets[0] === "string" ? r.bullets[0] : undefined;

    const explanationSummary = r.explanation?.summary ?? null;

    const explanationReasons =
      r.explanation?.reasons?.map((x) => ({
        code: x.code ?? null,
        label: x.label ?? null,
        text: x.text ?? null,
        strength: x.strength ?? null,
      })) ?? null;

    return {
      id,
      cardProps: {
        name,
        address: r.location ?? undefined,
        recommendReason: r.reason ?? undefined,
        subReason,
        compatibilityLabels,
        distanceM: typeof r.distance_m === "number" ? r.distance_m : undefined,
        rating: undefined,
        reviewCount: undefined,
        imageUrl: null,
        tags,
        href: typeof r.shrine_id === "number" ? `/shrines/${r.shrine_id}` : undefined,
        isFavorited: false,
        isTopPick: idx === 0,
        explanationSummary,
        explanationReasons,
      },
    };
  });
}
