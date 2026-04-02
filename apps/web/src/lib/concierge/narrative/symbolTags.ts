export const SYMBOL_TAGS = [
  "山",
  "水",
  "光",
  "鏡",
  "剣",
  "火",
  "結び",
  "道",
  "橋",
  "森",
  "岩",
  "風",
  "稲",
  "狐",
  "狼",
  "龍",
  "鳥居",
  "神紋",
] as const;

export type SymbolTag = (typeof SYMBOL_TAGS)[number];

export function isSymbolTag(value: string): value is SymbolTag {
  return (SYMBOL_TAGS as readonly string[]).includes(value);
}
