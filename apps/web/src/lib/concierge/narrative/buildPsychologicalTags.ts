import type { NeedTag } from "@/lib/concierge/narrative/types";
import type { PsychologicalTag } from "@/lib/concierge/narrative/psychologicalTags";
import { NEED_TO_PSYCHOLOGICAL_TAGS } from "@/lib/concierge/narrative/psychologicalTagMap";

type Args = {
  primaryNeed?: NeedTag | null;
  secondaryNeeds?: NeedTag[] | null;
};

export function buildPsychologicalTags(args: Args): PsychologicalTag[] {
  const tags: PsychologicalTag[] = [];

  const primary = args.primaryNeed ?? null;
  const secondary = args.secondaryNeeds ?? [];

  if (primary) {
    const primaryTags = NEED_TO_PSYCHOLOGICAL_TAGS[primary] ?? [];
    tags.push(...primaryTags);
  }

  for (const need of secondary) {
    const mapped = NEED_TO_PSYCHOLOGICAL_TAGS[need] ?? [];
    tags.push(...mapped);
  }

  // 重複削除
  return Array.from(new Set(tags));
}
