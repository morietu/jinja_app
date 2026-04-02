import type { PsychologicalTag } from "@/lib/concierge/narrative/psychologicalTags";
import type { SymbolTag } from "@/lib/concierge/narrative/symbolTags";

export const PSYCHOLOGICAL_TO_SYMBOL_TAGS: Record<PsychologicalTag, SymbolTag[]> = {
  決断: ["剣", "光", "岩"],
  前進: ["道", "光", "鳥居"],
  再出発: ["鳥居", "道", "風"],
  整理: ["鏡", "岩", "神紋"],
  回復: ["水", "森", "風"],
  安定: ["岩", "森", "神紋"],
  浄化: ["水", "火", "鏡"],
  集中: ["鏡", "剣", "岩"],
  継続: ["道", "稲", "森"],
  良縁: ["結び", "橋", "鳥居"],
  受容: ["水", "森", "結び"],
  節目: ["鳥居", "橋", "光"],
};
