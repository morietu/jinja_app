import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { buildShrineResolveHref } from "@/lib/nav/buildShrineResolveHref";

export function buildMapDetailHref(args: {
  shrineId?: number | null;
  placeId?: string | null;
  tid?: string | number | null;
}) {
  const tid = args.tid != null ? String(args.tid) : null;

  if (args.shrineId && Number.isFinite(args.shrineId) && args.shrineId > 0) {
    return buildShrineHref(args.shrineId, { ctx: "map", tid });
  }
  if (args.placeId && String(args.placeId).trim()) {
    return buildShrineResolveHref(String(args.placeId), { ctx: "map", tid });
  }
  return undefined;
}
