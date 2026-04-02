import type { PsychologicalTag } from "@/lib/concierge/narrative/psychologicalTags";
import type { SymbolTag } from "@/lib/concierge/narrative/symbolTags";
import { PSYCHOLOGICAL_TO_SYMBOL_TAGS } from "@/lib/concierge/narrative/symbolTagMap";

type Args = {
  psychologicalTags?: PsychologicalTag[] | null;
};

export function buildSymbolTags(args: Args): SymbolTag[] {
  const tags = args.psychologicalTags ?? [];

  const symbols: SymbolTag[] = [];

  for (const tag of tags) {
    const mapped = PSYCHOLOGICAL_TO_SYMBOL_TAGS[tag] ?? [];
    symbols.push(...mapped);
  }

  return Array.from(new Set(symbols));
}
