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

type ReasonFactsLike = {
  version?: 1;
  primary_axis?: "need" | "benefit" | "feature" | "element" | "distance" | "popularity" | "fallback" | null;
  secondary_axis?: "need" | "benefit" | "feature" | "element" | "distance" | "popularity" | "fallback" | null;
  matched_need_tags?: string[];
  matched_benefits?: string[];
  shrine_feature?: string | null;
  shrine_benefit?: string | null;
  visit_fit?: string | null;
  matched_element?: string | null;
  matched_sign?: string | null;
  distance_label?: string | null;
  popularity_label?: string | null;
  fallback_reason?: string | null;
  confidence?: "high" | "mid" | "low" | null;
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
  reason_facts?: ReasonFactsLike | null;
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

const NEED_PRIMARY_TEXT: Record<string, string> = {
  転機: "切り替えたい今に合いやすい候補です",
  仕事: "仕事の流れを整えたい時に向く候補です",
  厄除け: "気持ちを立て直したい時に合う候補です",
  恋愛: "ご縁を整えたい気持ちに寄り添いやすい候補です",
  健康: "心身を整えたい時に向きやすい候補です",
  金運: "流れを立て直したい時に意識しやすい候補です",
  学業: "集中して力を伸ばしたい時に向く候補です",
};

const ELEMENT_PRIMARY_TEXT: Record<string, string> = {
  火: "前向きに動きたい気質と合いやすい候補です",
  土: "落ち着いて整えたい時に向きやすい候補です",
  風: "流れを変えたい時に軽やかに選びやすい候補です",
  水: "静かに気持ちを整えたい時に馴染みやすい候補です",
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

function buildNeedPrimaryText(need: string): string {
  return NEED_PRIMARY_TEXT[need] ?? `${need}を意識した今に合いやすい候補です`;
}

function buildElementPrimaryText(element: string): string {
  return ELEMENT_PRIMARY_TEXT[element] ?? `${element}の要素と相性が良い候補です`;
}

function buildQueryCandidates(rec: RecommendationLike, needTags?: string[]): Candidate[] {
  const matched = uniq((rec.breakdown?.matched_need_tags ?? []).map(clean).filter(Boolean));
  const needs = uniq((needTags ?? []).map(clean).filter(Boolean));
  const mainNeed = matched[0] ?? needs[0];

  const out: Candidate[] = [];

  if (mainNeed) out.push({ key: "need_match", text: buildNeedPrimaryText(mainNeed) });

  if (matched.length >= 2) {
    out.push({ key: "text_match", text: `${matched[1]}の観点も含む候補です` });
  } else if (matched.length === 1) {
    out.push({ key: "text_match", text: "入力内容に沿って選びやすい候補です" });
  }

  if (typeof rec.astro_priority === "number" && rec.astro_priority > 0) {
    out.push({ key: "sign_match", text: "気質とのなじみも見られる候補です" });
  }

  const distance = formatDistance(rec.distance_m);
  if (distance) out.push({ key: "distance", text: `${distance}圏内で無理なく動きやすい候補です` });

  if (typeof rec.popular_score === "number") {
    out.push({ key: "popular", text: "定番としての安定感もあります" });
  }

  return out;
}

function buildBirthdateCandidates(rec: RecommendationLike): Candidate[] {
  const out: Candidate[] = [];
  const element = getPrimaryElement(rec);

  if (element) out.push({ key: "element_match", text: buildElementPrimaryText(element) });

  if (typeof rec.astro_priority === "number" && rec.astro_priority > 0) {
    out.push({ key: "sign_match", text: "気質とのなじみも見られる候補です" });
  }

  const distance = formatDistance(rec.distance_m);
  if (distance) out.push({ key: "distance", text: `${distance}圏内で落ち着いて向かいやすい候補です` });

  if (typeof rec.popular_score === "number") {
    out.push({ key: "popular", text: "定番としての安定感もあります" });
  }

  return out;
}

function buildFallbackCandidates(rec: RecommendationLike): Candidate[] {
  const out: Candidate[] = [];
  const distance = formatDistance(rec.distance_m);
  const hasPopular = typeof rec.popular_score === "number";

  if (distance) {
    out.push({ key: "distance", text: "まず動きやすさを優先して見られる候補です" });
    if (hasPopular) out.push({ key: "popular", text: "定番として選びやすい候補です" });
    return out;
  }

  if (hasPopular) {
    out.push({ key: "popular", text: "まず選びやすさを優先して見られる候補です" });
    out.push({ key: "distance", text: "無理なく選びやすい候補です" });
    return out;
  }

  out.push({ key: "distance", text: "まず動きやすさを優先して見られる候補です" });
  return out;
}

function buildFactsCandidates(rec: RecommendationLike): Candidate[] {
  const f = rec.reason_facts;
  if (!f) return [];

  const out: Candidate[] = [];

  const matchedNeed = clean(f.matched_need_tags?.[0]);
  const secondaryNeed = clean(f.matched_need_tags?.[1]);
  const benefit = clean(f.shrine_benefit);
  const feature = clean(f.shrine_feature);
  const visitFit = clean(f.visit_fit);
  const fallbackReason = clean(f.fallback_reason);
  const element = clean(f.matched_element);
  const distanceLabel = clean(f.distance_label);
  const popularityLabel = clean(f.popularity_label);

  switch (f.primary_axis) {
    case "need":
      if (matchedNeed) out.push({ key: "need_match", text: `${matchedNeed}を意識した今に合いやすい候補です` });
      break;
    case "benefit":
      if (benefit) out.push({ key: "need_match", text: `${benefit}の軸を重ねて見やすい候補です` });
      break;
    case "feature":
      if (feature) out.push({ key: "text_match", text: `${feature}点が今の流れに合いやすい候補です` });
      break;
    case "element":
      if (element) out.push({ key: "element_match", text: `${element}の相性軸で見やすい候補です` });
      break;
    case "distance":
      out.push({
        key: "distance",
        text: distanceLabel ? `${distanceLabel}圏で動きやすい候補です` : "無理なく足を運びやすい候補です",
      });
      break;
    case "popularity":
      out.push({
        key: "popular",
        text: popularityLabel || "選びやすさの安定感がある候補です",
      });
      break;
    case "fallback":
      out.push({
        key: "distance",
        text: fallbackReason || "まずは選びやすさを優先して見られる候補です",
      });
      break;
  }

  if (visitFit) out.push({ key: "text_match", text: visitFit });
  if (feature && f.primary_axis !== "feature") out.push({ key: "text_match", text: `${feature}点も見やすい候補です` });
  if (benefit && f.primary_axis !== "benefit")
    out.push({ key: "need_match", text: `${benefit}の方向とも重なりやすい候補です` });
  if (secondaryNeed) out.push({ key: "text_match", text: `${secondaryNeed}の観点も含む候補です` });
  if (element && f.primary_axis !== "element")
    out.push({ key: "sign_match", text: `${element}の相性傾向も見られる候補です` });
  if (popularityLabel && f.primary_axis !== "popularity") out.push({ key: "popular", text: popularityLabel });

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
      { key: "need_match", text: "今の気持ちに合いやすい候補です" },
      { key: "text_match", text: "相談内容に沿って見やすい候補です" },
    ],
    birthdate: [
      { key: "element_match", text: "相性を軸に見やすい候補です" },
      { key: "sign_match", text: "気質とのなじみを見やすい候補です" },
    ],
    fallback: [
      { key: "distance", text: "まず動きやすさで見やすい候補です" },
      { key: "popular", text: "まず選びやすさで見やすい候補です" },
    ],
  };

  const found = byType[inputType].find((x) => !blocked.has(clean(x.text)));
  return found ?? byType[inputType][0];
}

function buildTopReasonLabel(inputType: ReasonInputType, primaryKey: ReasonKey, index: number) {
  if (index !== 0) return undefined;
  if (inputType === "query") return primaryKey === "need_match" ? "相談に合う" : "内容に合う";
  if (inputType === "birthdate") return "相性が最も高い";
  if (inputType === "fallback") {
    if (primaryKey === "distance") return "まず動きやすい";
    if (primaryKey === "popular") return "まず選びやすい";
    return "おすすめ";
  }
  return undefined;
}

export function buildRecommendationReasonViewModel(params: BuildParams): RecommendationReasonViewModel {
  const inputType = resolveInputType(params);
  const factsCandidates = buildFactsCandidates(params.rec);

  const raw =
    factsCandidates.length > 0
      ? factsCandidates
      : inputType === "query"
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
          ? "生年月日との相性を軸に選びやすい候補です"
          : inputType === "fallback"
            ? "まずは動きやすさを優先して見られる候補です"
            : "今の気持ちに沿って選びやすい候補です",
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
