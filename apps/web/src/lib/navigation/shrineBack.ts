export const shrineBackContexts = ["map", "concierge"] as const;
export type ShrineBackContext = (typeof shrineBackContexts)[number];

export function parseShrineBackContext(v: string | null | undefined): ShrineBackContext {
  return shrineBackContexts.includes(v as any) ? (v as ShrineBackContext) : "map";
}

export function shrineBackConfig(ctx: ShrineBackContext, tid?: string | null) {
  switch (ctx) {
    case "concierge": {
      const t = tid && tid.trim() ? tid : "0";
      return { href: `/concierge?tid=${encodeURIComponent(t)}`, label: "コンシェルジュに戻る" };
    }
    case "map":
    default:
      return { href: "/map", label: "マップに戻る" };
  }
}
