import type { NeedTag } from "@/lib/concierge/narrative/types";
import type { PsychologicalTag } from "@/lib/concierge/narrative/psychologicalTags";

export const NEED_TO_PSYCHOLOGICAL_TAGS: Record<NeedTag, PsychologicalTag[]> = {
  money: ["安定", "再出発", "整理"],
  courage: ["前進", "決断", "再出発"],
  career: ["整理", "決断", "節目"],
  mental: ["回復", "浄化", "安定"],
  rest: ["回復", "受容", "浄化"],
  love: ["良縁", "受容", "安定"],
  study: ["集中", "継続", "整理"],
};

export function getPsychologicalTagsFromNeedTag(needTag?: NeedTag | null): PsychologicalTag[] {
  if (!needTag) return [];
  return NEED_TO_PSYCHOLOGICAL_TAGS[needTag] ?? [];
}
