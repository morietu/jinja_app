// apps/web/src/lib/nav/buildShrineHref.ts
export type ShrineHrefOpts = {
  ctx?: "concierge" | string;
  tid?: number | string | null;
};

export function buildShrineHref(shrineId: number | string, opts: ShrineHrefOpts = {}) {
  const id = encodeURIComponent(String(shrineId));
  const params = new URLSearchParams();

  if (opts.ctx) params.set("ctx", String(opts.ctx));
  if (opts.tid !== null && opts.tid !== undefined && String(opts.tid).trim() !== "") {
    params.set("tid", String(opts.tid));
  }

  const qs = params.toString();
  return `/shrines/${id}${qs ? `?${qs}` : ""}`;
}
