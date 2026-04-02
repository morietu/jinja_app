export const PSYCHOLOGICAL_TAGS = [
  "決断",
  "前進",
  "再出発",
  "整理",
  "回復",
  "安定",
  "浄化",
  "集中",
  "継続",
  "良縁",
  "受容",
  "節目",
] as const;

export type PsychologicalTag = (typeof PSYCHOLOGICAL_TAGS)[number];

export function isPsychologicalTag(value: string): value is PsychologicalTag {
  return (PSYCHOLOGICAL_TAGS as readonly string[]).includes(value);
}
