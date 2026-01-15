export const NEED_TAG_LABEL: Record<string, string> = {
  career: "転職・仕事",
  mental: "不安・メンタル",
  rest: "休息・疲れ",
  love: "恋愛",
  marriage: "縁結び・結婚",
  relationship: "人間関係",
  communication: "会話・発信",
  money: "金運・収入",
  study: "学業・試験",
  health: "健康",
  protection: "厄除け",
  courage: "決断・勇気",
  focus: "集中・継続",
  family: "子宝・安産",
  travel_safe: "旅行・安全",
};

export function labelNeedTag(tag: string): string {
  return NEED_TAG_LABEL[tag] ?? tag;
}
