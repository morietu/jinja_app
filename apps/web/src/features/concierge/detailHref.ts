// apps/web/src/features/concierge/detailHref.ts
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { buildShrineResolveHref } from "@/lib/nav/buildShrineResolveHref";

/**
 * Concierge recommendation → detail href (product spec)
 *
 * - 登録済み: shrine_id / shrineId / shrine.id を持つ → /shrines/:id
 * - 未登録: place_id / placeId（など）だけを持つ → /shrines/resolve?place_id=...
 * - IDなし: null（UIは詳細導線を表示しない）
 *
 * 注意:
 * recommendation の `id` は shrine_id ではない可能性があるため使わない。
 * 実在 shrine への導線は shrine_id / shrineId / shrine.id のみを採用する。
 */

type AnyObj = Record<string, any>;

export function pickPlaceId(item: AnyObj): string | null {
  const v =
    item?.place_id ?? item?.placeId ?? item?.google?.place_id ?? item?.google?.placeId ?? item?.place?.id ?? null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function pickShrineId(item: AnyObj): number | null {
  const v = item?.shrine_id ?? item?.shrineId ?? item?.shrine?.id ?? null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

export function detailHrefFromRecommendation(
  item: AnyObj,
  ctx?: { ctx?: string; tid?: string | number },
): string | null {
  const shrineId = pickShrineId(item);
  if (shrineId != null) {
    return buildShrineHref(shrineId, {
      ctx: ctx?.ctx,
      tid: ctx?.tid ?? undefined,
    });
  }

  const placeId = pickPlaceId(item);
  if (placeId) {
    return buildShrineResolveHref(placeId, {
      ctx: ctx?.ctx === "map" || ctx?.ctx === "concierge" ? ctx.ctx : "concierge",
      tid: ctx?.tid != null ? String(ctx.tid) : null,
    });
  }

  return null;
}
