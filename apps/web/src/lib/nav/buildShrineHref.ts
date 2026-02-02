// apps/web/src/lib/nav/buildShrineHref.ts
export type ShrineHrefOpts = {
  ctx?: "concierge" | string;
  tid?: number | string | null;

  /** 追加クエリ（toast, place_id など） */
  query?: Record<string, string | number | boolean | null | undefined>;

  /** /shrines/:id の後ろに付けるサブパス（例: "goshuins"） */
  subpath?: string | null;

  /** #goshuins など（#は不要） */
  hash?: string | null;
};

export function buildShrineHref(shrineId: number | string, opts: ShrineHrefOpts = {}) {
  const id = encodeURIComponent(String(shrineId));

  const params = new URLSearchParams();

  if (opts.ctx) params.set("ctx", String(opts.ctx));
  if (opts.tid !== null && opts.tid !== undefined && String(opts.tid).trim() !== "") {
    params.set("tid", String(opts.tid));
  }

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === null || v === undefined) continue;
      const s = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
      if (s.trim() === "") continue;
      params.set(k, s);
    }
  }

  const sub = (opts.subpath ?? "").toString().trim();
  const base = `/shrines/${id}${sub ? `/${sub.replace(/^\/+/, "")}` : ""}`;

  const qs = params.toString();
  const withQs = qs ? `${base}?${qs}` : base;

  const hash = (opts.hash ?? "").toString().trim().replace(/^#/, "");
  return hash ? `${withQs}#${hash}` : withQs;
}
