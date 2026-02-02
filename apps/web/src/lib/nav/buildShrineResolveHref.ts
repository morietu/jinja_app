// apps/web/src/lib/nav/buildShrineResolveHref.ts
export type ShrineResolveHrefOpts = {
  ctx?: "map" | "concierge" | null;
  tid?: string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
};

function setIf(q: URLSearchParams, k: string, v: unknown) {
  if (v === null || v === undefined) return;
  const s = typeof v === "string" ? v : String(v);
  if (!s.trim()) return;
  q.set(k, s);
}

export function buildShrineResolveHref(placeId: string, opts: ShrineResolveHrefOpts = {}) {
  const q = new URLSearchParams();

  // 任意 query を先に入れてから、必須パラメータで上書き（事故防止）
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) setIf(q, k, v);
  }

  setIf(q, "place_id", placeId);
  if (opts.ctx) setIf(q, "ctx", opts.ctx);
  if (opts.tid) setIf(q, "tid", opts.tid);

  return `/shrines/resolve?${q.toString()}`;
}
