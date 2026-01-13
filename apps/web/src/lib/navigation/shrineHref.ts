// apps/web/src/lib/navigation/shrineHref.ts
export function shrineDetailHref(args: {
  shrineId?: number | null;
  placeId?: string | null;
  ctx?: string | null;
  tid?: string | null;
}) {
  const q = new URLSearchParams();
  if (args.ctx) q.set("ctx", args.ctx);
  if (args.tid) q.set("tid", args.tid);

  // ✅ DBの shrine_id があるなら /shrines/:id
  if (typeof args.shrineId === "number" && Number.isFinite(args.shrineId)) {
    const base = `/shrines/${args.shrineId}`;
    return q.toString() ? `${base}?${q.toString()}` : base;
  }

  // ✅ place_id しかないなら /shrines/from-place/:placeId
  if (args.placeId) {
    const base = `/shrines/from-place/${encodeURIComponent(args.placeId)}`;
    return q.toString() ? `${base}?${q.toString()}` : base;
  }

  // どっちも無いのは異常値なので地図へ戻す
  return "/map?toast=invalid_shrine";
}
