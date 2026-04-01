import type { ConciergeResultItem } from "@/viewmodels/conciergeResultItem";
import { buildDeepReason } from "@/lib/concierge/buildDeepReason";

export type ConciergeResponse = {
  ok: boolean;
  plan?: "anonymous" | "free" | "premium" | null;
  remaining?: number | null;
  limit?: number | null;
  limitReached?: boolean;
  reply?: string | null;
  thread_id?: string | null;
  data?: {
    thread_id?: string | null;
    _need?: { tags?: string[] };
    _signals?: Record<string, unknown> | null;
    message?: string | null;
    recommendations?: any[];
  };
};

const NEED_LABELS: Record<string, string> = {
  career: "仕事・転機",
  mental: "不安・気持ち",
  love: "良縁・恋愛",
  money: "金運・流れ",
  rest: "休息",
  courage: "前進・後押し",
  protection: "厄除け・守護",
  focus: "集中・継続",
};

type NeedTag = "money" | "courage" | "career" | "mental" | "rest" | "love" | "study";
type ShrineTone = "strong" | "quiet" | "tight" | "neutral";

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

function normalizeShrineName(name?: string | null): string {
  return (name ?? "").replace(/\s+/g, "").trim();
}

function getShrineTone(shrineName?: string | null): ShrineTone {
  const name = normalizeShrineName(shrineName);

  if (name.includes("三峯")) return "strong";
  if (name.includes("伊勢神宮") || name.includes("内宮")) return "quiet";
  if (name.includes("乃木")) return "tight";

  return "neutral";
}

function isPrimaryNeedTag(tag: string): tag is NeedTag {
  return ["money", "courage", "career", "mental", "rest", "love", "study"].includes(tag);
}

function resolveCardPrimaryTag(args: {
  primaryReasonLabel?: string | null;
  fallbackTags?: string[] | null;
}): NeedTag | null {
  const primaryReasonLabel = (args.primaryReasonLabel ?? "").trim();

  if (isPrimaryNeedTag(primaryReasonLabel)) {
    return primaryReasonLabel;
  }

  const fallbackTags = Array.isArray(args.fallbackTags) ? args.fallbackTags : [];
  const tags = fallbackTags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(isPrimaryNeedTag);

  if (tags.includes("courage")) return "courage";
  if (tags.includes("money")) return "money";
  if (tags.includes("career")) return "career";
  if (tags.includes("mental")) return "mental";
  if (tags.includes("rest")) return "rest";
  if (tags.includes("love")) return "love";
  if (tags.includes("study")) return "study";

  return tags[0] ?? null;
}

function buildCardPrimaryReason(
  shrineName?: string | null,
  primaryTag?: NeedTag | null,
  fallbackText?: string | null,
): string | null {
  if (!primaryTag) return fallbackText ?? null;

  const tone = getShrineTone(shrineName);

  if (primaryTag === "courage") {
    if (tone === "strong") return "流れを切り替えたい時に";
    if (tone === "tight") return "次の一歩を決めたい時に";
    if (tone === "quiet") return "気持ちを整えて決めたい時に";
    return "前に進むきっかけがほしい時に";
  }

  if (primaryTag === "mental") {
    if (tone === "strong") return "気持ちを切り替えたい時に";
    if (tone === "tight") return "気持ちを立て直したい時に";
    return "不安や気持ちを整えたい時に";
  }

  if (primaryTag === "career") {
    if (tone === "strong") return "仕事の停滞を動かしたい時に";
    if (tone === "tight") return "仕事や転機の判断を定めたい時に";
    return "仕事や転機を整理したい時に";
  }

  if (primaryTag === "money") {
    if (tone === "strong") return "流れを立て直したい時に";
    if (tone === "quiet") return "巡りを整えたい時に";
    return "金運や流れを整えたい時に";
  }

  if (primaryTag === "rest") {
    if (tone === "quiet") return "静かに休みたい時に";
    return "心身を整え直したい時に";
  }

  if (primaryTag === "love") {
    if (tone === "quiet") return "関係性を見直したい時に";
    return "良縁や関係性に向き合いたい時に";
  }

  if (primaryTag === "study") {
    if (tone === "tight") return "集中や目標を定めたい時に";
    return "集中を整え直したい時に";
  }

  return fallbackText ?? null;
}

export function conciergeToShrineListItems(resp: ConciergeResponse): ConciergeResultItem[] {
  if (!resp?.ok) {
    console.log("[conciergeToShrineListItems] resp not ok", resp);
    return [];
  }

  const recs = resp.data?.recommendations ?? [];
  const threadId =
    typeof resp.thread_id === "string" && resp.thread_id.trim()
      ? resp.thread_id.trim()
      : typeof resp.data?.thread_id === "string" && resp.data.thread_id.trim()
        ? resp.data.thread_id.trim()
        : null;

  console.log("[conciergeToShrineListItems] recs", recs.length, recs);
  console.log("[conciergeToShrineListItems] threadId", threadId);

  const items = recs
    .filter((r): r is typeof r & { shrine_id: number } => typeof r.shrine_id === "number")
    .map((r) => {
      const id = safeId(r);
      const name = r.display_name ?? r.name;

      const matchedTags = normalizeTagList(r.breakdown?.matched_need_tags);
      const rawTags = matchedTags.length ? matchedTags : normalizeTagList(resp.data?._need?.tags);
      const tags = rawTags.map(toDisplayTag).slice(0, 3);

      const explanationSummary = r.explanation?.summary?.trim() || null;
      const rawReason =
        r._explanation_payload?.original_reason?.trim() || explanationSummary || r.reason?.trim() || null;

      console.log("primaryReasonLabel", r._explanation_payload?.primary_reason?.label);
      const primaryReasonLabel = r._explanation_payload?.primary_reason?.label?.trim() || null;

      const primaryTag = resolveCardPrimaryTag({
        primaryReasonLabel,
        fallbackTags: rawTags,
      });

      const fallbackShort = buildCardPrimaryReason(name, primaryTag, rawReason) ?? rawReason;

      const deepReason = buildDeepReason({
        shrineName: name,
        primaryTag,
        rawReason,
        fallbackShort,
        shrineTone: getShrineTone(name),
      });

      const primaryMeaning = deepReason.short ?? fallbackShort ?? rawReason;

      console.log("rec keys", Object.keys(r));
      console.log("_explanation_payload", r._explanation_payload);
      console.log("primary_reason", r._explanation_payload?.primary_reason);

      return {
        id,
        tid: threadId,
        cardProps: {
          shrineId: r.shrine_id,
          title: name,
          address: r.address ?? r.location ?? undefined,
          imageUrl: null,
          explanationSummary,
          explanationPrimaryReason: primaryMeaning,
          breakdown: r.breakdown ?? null,
          badgesOverride: tags,
        },
        deepReason,
      };
    });

  console.log("[conciergeToShrineListItems] items", items.length, items);
  return items;
}
