// apps/web/src/lib/bff/origin.ts
export function toOrigin(raw: string, fallback: string) {
  const s = (raw ?? "").trim();
  if (!s) return fallback;
  return s.replace(/\/api\/?$/, ""); // /api を剥がす
}

export function clampLimit(v: string | null, def: number, max: number) {
  const n = v ? Number(v) : def;
  const m = Number.isFinite(n) ? Math.floor(n) : def;
  return Math.max(1, Math.min(max, m));
}


