// apps/web/src/features/concierge/detailHref.ts
/**
 * Concierge recommendation → detail href (product spec)
 *
 * - 登録済み: shrine_id / shrineId / shrine.id を持つ → /shrines/:id
 * - 未登録: place_id / placeId（など）だけを持つ → /places/:placeId
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
  const q = new URLSearchParams();
  if (ctx?.ctx) q.set("ctx", ctx.ctx);
  if (ctx?.tid != null) q.set("tid", String(ctx.tid));
  const qs = q.toString();
  const suffix = qs ? `?${qs}` : "";

  const shrineId = pickShrineId(item);
  if (shrineId != null) return `/shrines/${shrineId}${suffix}`;

  const placeId = pickPlaceId(item);
  if (placeId) return `/places/${encodeURIComponent(placeId)}${suffix}`;

  return null;
}
