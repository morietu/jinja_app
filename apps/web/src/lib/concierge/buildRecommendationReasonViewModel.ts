// apps/web/src/lib/concierge/buildRecommendationReasonViewModel.ts

export type ReasonInputType = "query" | "birthdate" | "fallback";
export type ReasonKey = "need_match" | "text_match" | "element_match" | "sign_match" | "distance" | "popular";

export type RecommendationReasonViewModel = {
  inputType: ReasonInputType;
  primaryReason: string;
  secondaryReason?: string;
  topReasonLabel?: string;
  summary: string;
  reasonKeys: {
    primary: ReasonKey;
    secondary?: ReasonKey;
    summary: ReasonKey;
  };
};

type BreakdownLike = {
  matched_need_tags?: string[];
  score_need?: number;
  score_element?: number;
  score_popular?: number;
  score_total?: number;
  weights?: {
    element?: number;
    need?: number;
    popular?: number;
  };
};

type RecommendationLike = {
  name?: string | null;
  display_name?: string | null;
  reason?: string | null;
  breakdown?: BreakdownLike | null;
  distance_m?: number | null;
  popular_score?: number | null;
  astro_elements?: string[] | null;
  astro_priority?: number | null;
  fallback_mode?: string | null;
  explanation?: {
    summary?: string | null;
    reasons?: Array<{ text?: string | null }> | null;
  } | null;
};

type BuildParams = {
  rec: RecommendationLike;
  index: number;
  mode?: "need" | "compat" | string | null;
  birthdate?: string | null;
  needTags?: string[];
};

type Candidate = {
  key: ReasonKey;
  text: string;
};

const ELEMENT_LABELS: Record<string, string> = {
  fire: "火",
  earth: "土",
  air: "風",
  water: "水",
};

function clean(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function formatDistance(distanceM?: number | null): string | null {
  if (typeof distanceM !== "number" || Number.isNaN(distanceM)) return null;
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(1)}km`;
}

function resolveInputType(params: BuildParams): ReasonInputType {
  const { rec, mode, birthdate } = params;

  if (rec.fallback_mode === "nearby_unfiltered") return "fallback";
  if (mode === "compat") return "birthdate";
  if (birthdate && !clean(params.needTags?.join(" "))) return "birthdate";
  return "query";
}

function getPrimaryElement(rec: RecommendationLike): string | null {
  const raw = rec.astro_elements?.[0];
  if (!raw) return null;
  return ELEMENT_LABELS[String(raw).toLowerCase()] ?? String(raw);
}

function buildQueryCandidates(rec: RecommendationLike, needTags?: string[]): Candidate[] {
  const matched = uniq((rec.breakdown?.matched_need_tags ?? []).map(clean).filter(Boolean));
  const needs = uniq((needTags ?? []).map(clean).filter(Boolean));
  const mainNeed = matched[0] ?? needs[0];

  const out: Candidate[] = [];

  if (mainNeed) {
    out.push({ key: "need_match", text: `${mainNeed}との一致` });
  }

  if (matched.length >= 2) {
    out.push({ key: "text_match", text: `${matched[1]}の意図も拾えています` });
  } else if (matched.length === 1) {
    out.push({ key: "text_match", text: "相談文との一致が高い候補です" });
  }

  const distance = formatDistance(rec.distance_m);
  if (distance) {
    out.push({ key: "distance", text: `${distance}圏内で行きやすい候補です` });
  }

  if (typeof rec.popular_score === "number") {
    out.push({ key: "popular", text: "人気も安定しています" });
  }

  return out;
}

function buildBirthdateCandidates(rec: RecommendationLike): Candidate[] {
  const out: Candidate[] = [];
  const element = getPrimaryElement(rec);

  if (element) {
    out.push({ key: "element_match", text: `${element}の要素との相性が良いです` });
  }

  if (typeof rec.astro_priority === "number" && rec.astro_priority > 0) {
    out.push({ key: "sign_match", text: "生年月日ベースの相性が強めです" });
  }

  const distance = formatDistance(rec.distance_m);
  if (distance) {
    out.push({ key: "distance", text: `${distance}圏内で参拝しやすいです` });
  }

  if (typeof rec.popular_score === "number") {
    out.push({ key: "popular", text: "人気も安定しています" });
  }

  return out;
}

function buildFallbackCandidates(rec: RecommendationLike): Candidate[] {
  const out: Candidate[] = [];
  const distance = formatDistance(rec.distance_m);

  if (distance) {
    out.push({ key: "distance", text: `${distance}圏内で行きやすい候補です` });
  }

  if (typeof rec.popular_score === "number") {
    out.push({ key: "popular", text: "人気の高い候補です" });
  }

  return out;
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seenKeys = new Set<string>();
  const seenTexts = new Set<string>();

  return candidates.filter((c) => {
    const text = clean(c.text);
    if (!text) return false;
    if (seenKeys.has(c.key)) return false;
    if (seenTexts.has(text)) return false;
    seenKeys.add(c.key);
    seenTexts.add(text);
    return true;
  });
}

function buildSummary(
  inputType: ReasonInputType,
  primary: Candidate,
  secondary?: Candidate,
): { key: ReasonKey; text: string } {
  const blocked = new Set([clean(primary.text), clean(secondary?.text)]);

  const byType: Record<ReasonInputType, Array<{ key: ReasonKey; text: string }>> = {
    query: [
      { key: "need_match", text: "今の願いに合う神社です" },
      { key: "text_match", text: "相談内容との一致が高い候補です" },
    ],
    birthdate: [
      { key: "element_match", text: "生年月日との相性が良い神社です" },
      { key: "sign_match", text: "気質面の相性を重視した候補です" },
    ],
    fallback: [
      { key: "distance", text: "行きやすさを優先した候補です" },
      { key: "popular", text: "選ばれやすさを優先した候補です" },
    ],
  };

  const found = byType[inputType].find((x) => !blocked.has(clean(x.text)));
  return found ?? byType[inputType][0];
}

function buildTopReasonLabel(inputType: ReasonInputType, primaryKey: ReasonKey, index: number) {
  if (index !== 0) return undefined;

  if (inputType === "query") {
    return primaryKey === "need_match" ? "最も一致度が高い" : "相談内容に合う";
  }
  if (inputType === "birthdate") {
    return "相性が最も高い";
  }
  if (inputType === "fallback") {
    if (primaryKey === "distance") return "行きやすさ優先";
    if (primaryKey === "popular") return "人気上位";
    return "おすすめ";
  }

  return undefined;
}

export function buildRecommendationReasonViewModel(params: BuildParams): RecommendationReasonViewModel {
  const inputType = resolveInputType(params);

  const raw =
    inputType === "query"
      ? buildQueryCandidates(params.rec, params.needTags)
      : inputType === "birthdate"
        ? buildBirthdateCandidates(params.rec)
        : buildFallbackCandidates(params.rec);

  const candidates = dedupeCandidates(raw);

  const primary =
    candidates[0] ??
    ({
      key: inputType === "birthdate" ? "element_match" : inputType === "fallback" ? "distance" : "need_match",
      text:
        inputType === "birthdate"
          ? "生年月日との相性を見て選んだ候補です"
          : inputType === "fallback"
            ? "行きやすさを優先した候補です"
            : "今の願いに近い候補です",
    } satisfies Candidate);

  const secondary = candidates.slice(1).find((x) => x.key !== primary.key && clean(x.text) !== clean(primary.text));

  const summary = buildSummary(inputType, primary, secondary);

  return {
    inputType,
    primaryReason: primary.text,
    secondaryReason: secondary?.text,
    topReasonLabel: buildTopReasonLabel(inputType, primary.key, params.index),
    summary: summary.text,
    reasonKeys: {
      primary: primary.key,
      secondary: secondary?.key,
      summary: summary.key,
    },
  };
}
