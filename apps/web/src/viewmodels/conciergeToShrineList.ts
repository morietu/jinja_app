import type { ShrineListItem } from "@/components/shrines/ShrineList";

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
        score_element?: number | null;
      } | null;
      _signals?: Record<string, unknown> | null;
      _astro?: Record<string, unknown> | null;
    }>;
  };
};

const NEED_LABELS: Record<string, string> = {
  career: "転機・仕事",
  mental: "不安・心",
  love: "恋愛",
  money: "金運",
  rest: "休息",
  courage: "前進・後押し",
  protection: "厄除け・守護",
  focus: "集中・継続",
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

function pickCompatSummary(rec: any, rootAstro?: any): string | null {
  const astro = rec?._signals?.astro ?? rec?._astro ?? rootAstro ?? null;

  if (astro && typeof astro === "object") {
    if (typeof astro.label_ja === "string" && astro.label_ja.trim()) {
      return `${astro.label_ja}の性質と重なる相性`;
    }
    if (typeof astro.element === "string" && astro.element.trim()) {
      return `${astro.element}の性質と重なる相性`;
    }
  }

  const scoreElement = rec?.breakdown?.score_element;
  if (typeof scoreElement === "number" && scoreElement >= 1) {
    return "誕生日由来の相性も踏まえた候補";
  }

  return null;
}

function pickCompatReason(rec: any, rootAstro?: any): string | null {
  const astro = rec?._signals?.astro ?? rec?._astro ?? rootAstro ?? null;

  if (astro && typeof astro === "object" && typeof astro.reason === "string" && astro.reason.trim()) {
    return astro.reason;
  }

  const scoreElement = rec?.breakdown?.score_element;
  if (typeof scoreElement === "number" && scoreElement >= 1) {
    return "誕生日由来の相性要素も踏まえて選ばれています。";
  }

  return null;
}

export function conciergeToShrineListItems(resp: ConciergeResponse): ShrineListItem[] {
  if (!resp?.ok) return [];

  const recs = Array.isArray(resp.data?.recommendations) ? resp.data.recommendations : [];
  const fallbackTags = normalizeTagList(resp.data?._need?.tags);

  const rootSignals =
    resp.data?._signals && typeof resp.data._signals === "object"
      ? (resp.data._signals as Record<string, unknown> & {
          mode?: { mode?: "need" | "compat" | null } | null;
          astro?: unknown;
        })
      : null;

  const responseMode =
    rootSignals?.mode?.mode === "compat" ? "compat" : rootSignals?.mode?.mode === "need" ? "need" : null;

  const rootAstro = rootSignals?.astro ?? null;

  return recs.map((r, idx) => {
    const id = safeId(r);
    const name = r.display_name ?? r.name;

    const matchedTags = normalizeTagList(r.breakdown?.matched_need_tags);
    const rawTags = matchedTags.length ? matchedTags : fallbackTags;

    const tags = rawTags.map(toDisplayTag).slice(0, 3);
    const compatibilityLabels = responseMode === "compat" ? matchedTags.map(toDisplayTag).slice(0, 1) : [];

    const explanationSummary = r.explanation?.summary?.trim() || null;

    const explanationReasons =
      r.explanation?.reasons
        ?.map((x) => ({
          code: x.code ?? null,
          label: x.label ?? null,
          text: x.text?.trim() ?? null,
          strength: x.strength ?? null,
        }))
        .filter((x) => x.text) ?? null;

    const recommendReason = explanationSummary || r.reason?.trim() || null;
    const subReason = Array.isArray(r.bullets) && typeof r.bullets[0] === "string" ? r.bullets[0] : undefined;

    const compatSummary = responseMode === "compat" ? pickCompatSummary(r, rootAstro) : null;
    const compatReason = responseMode === "compat" ? pickCompatReason(r, rootAstro) : null;

    console.log("MAPPER_MODE", {
      name,
      responseMode,
      scoreElement: r.breakdown?.score_element ?? null,
      compatSummary,
      compatReason,
    });

    return {
      id,
      cardProps: {
        name,
        address: r.location ?? undefined,
        recommendReason,
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
        compatSummary,
        compatReason,
      },
    };
  });
}
