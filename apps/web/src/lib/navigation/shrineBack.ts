export const shrineBackContexts = ["map", "concierge", "history"] as const;
export type ShrineBackContext = (typeof shrineBackContexts)[number];

export function parseShrineBackContext(v: string | null | undefined): ShrineBackContext {
  return shrineBackContexts.includes(v as any) ? (v as ShrineBackContext) : "map";
}

export function shrineBackConfig(ctx: ShrineBackContext) {
  switch (ctx) {
    case "concierge":
      return { href: "/concierge?tid=0", label: "コンシェルジュに戻る" };
    case "history":
      return { href: "/concierge/history", label: "履歴に戻る" };
    case "map":
    default:
      return { href: "/map", label: "マップに戻る" };
  }
}
