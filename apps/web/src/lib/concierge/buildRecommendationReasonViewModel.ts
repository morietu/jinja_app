// apps/web/src/lib/concierge/buildRecommendationReasonViewModel.ts

export type ReasonInputType = "query" | "birthdate" | "fallback";
export type ReasonKey = "need_match" | "text_match" | "element_match" | "sign_match" | "distance" | "popular";

export type RecommendationReasonViewModel = {
  inputType: ReasonInputType;
  hero: {
    topReasonLabel?: string;
    catchCopy: string;
  };
  why: {
    summary: string;
    primaryReason: string;
    secondaryReason?: string;
    reasonKeys: {
      primary: ReasonKey;
      secondary?: ReasonKey;
      summary: ReasonKey;
    };
  };
  interpretation: {
    consultationSummary: string;
    shrineMeaning: string;
    actionMeaning?: string;
  };
  rank: {
    whyTop?: string;
    differenceFromOthers?: string;
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
  if (benefit && f.primary_axis !== "benefit") {
    out.push({ key: "need_match", text: `${benefit}の方向とも重なりやすい候補です` });
  }
  if (secondaryNeed) out.push({ key: "text_match", text: `${secondaryNeed}の観点も含む候補です` });
  if (element && f.primary_axis !== "element") {
    out.push({ key: "sign_match", text: `${element}の相性傾向も見られる候補です` });
  }
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

function buildHeroCatchCopy(params: BuildParams, primary: Candidate): string {
  if (params.mode === "compat") {
    return "相性から静かに選びたい時の神社";
  }

  const need = clean(params.needTags?.[0]);

  if (need === "厄除け") return "気持ちを立て直したい時の神社";
  if (need === "仕事") return "仕事の流れを整えたい時の神社";
  if (need === "金運") return "流れを切り替えたい時の神社";

  if (primary.key === "distance") return "まず行きやすさを優先したい時の神社";
  if (primary.key === "element_match") return "相性から無理なく選びたい時の神社";

  return "今の状態に重ねて見やすい神社";
}



function buildActionMeaning(params: BuildParams, secondary?: Candidate): string | undefined {
  if (!secondary) return undefined;
  if (secondary.key === "distance") return "思い切りより、まず行けることを優先する意味があります。";
  if (secondary.key === "popular") return "迷いがある時ほど、選びやすさを支えにできる候補です。";
  return "複数の観点を重ねながら、今の自分に合う形で受け取りやすい候補です。";
}

function buildStateStuckText(params: BuildParams, primary: Candidate): string {
  const need = clean(params.needTags?.[0]);

  if (params.mode === "compat") {
    return "今は勢いで答えを出すほど感覚がぶれやすく、合う・合わないを静かに見極めたい状態です。";
  }

  if (need === "厄除け") {
    return "不安や引っかかりが続く時は、考えるほど判断が散って、気持ちの消耗が先に進みやすくなります。";
  }

  if (need === "仕事") {
    return "仕事のことを考え続けている時は、動き方より先に優先順位が崩れて、判断が散りやすくなります。";
  }

  if (need === "金運") {
    return "流れを変えたい時ほど、焦って手を打つほど空回りしやすく、立て直しの軸がぼやけやすくなります。";
  }

  if (need === "転機") {
    return "切り替えたい気持ちが強い時ほど、急いで結論を出そうとして判断が粗くなり、流れの見極めが雑になりやすくなります。";
  }

  if (need === "恋愛") {
    return "関係のことを気にし続けている時は、相手より先に自分の受け取り方が揺れて、気持ちの置き場が散りやすくなります。";
  }

  if (need === "健康") {
    return "心身の不調が気になる時は、整えたい気持ちが先走るほど、休むことと立て直すことの順番が崩れやすくなります。";
  }

  if (need === "学業") {
    return "結果を意識し続けている時は、やるべきことより不安の処理が先に膨らみ、集中の軸がぶれやすくなります。";
  }

  if (primary.key === "distance") {
    return "今は遠くの正解を探すほど動けなくなりやすく、まず無理なく足を運べる選択肢から見た方が流れを切り替えやすい状態です。";
  }

  if (primary.key === "element_match" || primary.key === "sign_match") {
    return "今は強い刺激よりも、気質に無理なく馴染む場所の方が受け取りやすく、考えすぎをほどきやすい状態です。";
  }

  return "今は答えを急ぐほど判断が散りやすく、先に状態を整えられる候補から見た方が意味づけしやすい状態です。";
}

function buildStatePriorityText(params: BuildParams, primary: Candidate): string {
  const need = clean(params.needTags?.[0]);

  if (params.mode === "compat") {
    return "今は結論を急ぐより、相性として無理がないか、落ち着いて受け取れる場所かを先に整理するのが合っています。";
  }

  if (need === "厄除け") {
    return "今は解決策を増やすより先に、気持ちを落ち着かせて、何を立て直したいのかを整理できる場を優先するのが合っています。";
  }

  if (need === "仕事") {
    return "今は次の一手を増やすより先に、何を進めて何を止めるかを整理できる場を優先するのが合っています。";
  }

  if (need === "金運") {
    return "今は一発で変えることより先に、止まった流れを整え直して、立て直しの軸を作れる場を優先するのが合っています。";
  }

  if (need === "転機") {
    return "今は答えを急いで決めるより先に、どこを切り替えて何を残すかを整理できる場を優先するのが合っています。";
  }

  if (need === "恋愛") {
    return "今は相手の反応を追うより先に、自分の気持ちの置き場を整えて、関係をどう見たいかを整理できる場を優先するのが合っています。";
  }

  if (need === "健康") {
    return "今は無理に立て直そうとするより先に、消耗を増やさず整える順番を取り戻せる場を優先するのが合っています。";
  }

  if (need === "学業") {
    return "今は量を増やすより先に、集中を削っている要因を静かに整理できる場を優先するのが合っています。";
  }

  if (primary.key === "distance") {
    return "今は理想の候補を探し切るより先に、実際に動ける場所から流れを切り替えることを優先するのが合っています。";
  }

  if (primary.key === "element_match" || primary.key === "sign_match") {
    return "今は強く変わることより先に、無理なく受け取れて気持ちを整えやすい場所を優先するのが合っています。";
  }

  return "今は答えを出すことより先に、状態を整えながら優先順位を見直せる場を優先するのが合っています。";
}

function buildStateShrineMeaningText(params: BuildParams, primary: Candidate): string {
  if (primary.key === "distance") {
    return "この神社は、行けること自体が負担になりにくく、止まった流れを切り替える最初の一歩として置きやすい候補です。";
  }

  if (primary.key === "element_match" || primary.key === "sign_match") {
    return "この神社は、気質との無理のなさから身構えずに向き合いやすく、考えすぎた状態をほどきながら整理しやすい候補です。";
  }

  if (params.mode === "compat") {
    return "この神社は、相性の無理のなさから落ち着いて受け取りやすく、今の状態を静かに整えながら意味を重ねやすい候補です。";
  }

  return "この神社は、今の詰まり方に対して無理なく重ねやすく、気持ちと流れを整えながら次の見方を作りやすい候補です。";
}

function buildConsultationSummary(params: BuildParams, primary: Candidate, _secondary?: Candidate): string {
  const stuck = buildStateStuckText(params, primary);
  const priority = buildStatePriorityText(params, primary);
  const shrineMeaning = buildStateShrineMeaningText(params, primary);

  return `${stuck} ${priority} ${shrineMeaning}`;
}

function buildShrineMeaning(params: BuildParams, primary: Candidate): string {
  return buildStateShrineMeaningText(params, primary);
}

function buildRankReason(
  params: BuildParams,
  primary: Candidate,
  _secondary?: Candidate,
): { whyTop?: string; differenceFromOthers?: string } {
  if (params.index !== 0) {
    return {};
  }

  if (primary.key === "need_match") {
    return {
      whyTop: "今回の候補の中でも、相談内容との一致が最も強く見られる候補です。",
      differenceFromOthers: "他候補よりも、今優先したいテーマにまっすぐ重なりやすい位置づけです。",
    };
  }

  if (primary.key === "element_match" || primary.key === "sign_match") {
    return {
      whyTop: "今回の候補の中でも、相性の無理のなさが強く見られる候補です。",
      differenceFromOthers: "他候補よりも、気質に無理なく馴染みやすい点が上位理由になっています。",
    };
  }

  if (primary.key === "distance") {
    return {
      whyTop: "今回の候補の中でも、まず実際に動きやすい条件が強い候補です。",
      differenceFromOthers: "他候補よりも、行けること自体が負担になりにくい点を優先しています。",
    };
  }

  if (primary.key === "popular") {
    return {
      whyTop: "今回の候補の中でも、選びやすさの安定感が強い候補です。",
      differenceFromOthers: "他候補よりも、迷いがある段階で選択しやすい点を優先しています。",
    };
  }

  return {
    whyTop: "今回の候補の中でも、今の状態との重なりが最も強く見られる候補です。",
    differenceFromOthers: "他候補よりも、今優先したい整理軸に沿って受け取りやすい位置づけです。",
  };
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

  const secondary = candidates
    .slice(1)
    .find((x) => x.key !== primary.key && clean(x.text) !== clean(primary.text));
  const summary = buildSummary(inputType, primary, secondary);

  const rank = buildRankReason(params, primary, secondary);

  return {
    inputType,
    hero: {
      topReasonLabel: buildTopReasonLabel(inputType, primary.key, params.index),
      catchCopy: buildHeroCatchCopy(params, primary),
    },
    why: {
      summary: summary.text,
      primaryReason: primary.text,
      secondaryReason: secondary?.text,
      reasonKeys: {
        primary: primary.key,
        secondary: secondary?.key,
        summary: summary.key,
      },
    },
    interpretation: {
      consultationSummary: buildConsultationSummary(params, primary, secondary),
      shrineMeaning: buildShrineMeaning(params, primary),
      actionMeaning: buildActionMeaning(params, secondary),
    },
    rank,
  };
}
