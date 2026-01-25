// apps/web/src/lib/bff/origin.ts
export function toOrigin(raw: string | undefined | null, fallback: string) {
  const s = (raw ?? "").trim();
  const base = s || fallback;

  // 末尾の /api を剥がす（事故の温床をここで潰す）
  // さらに末尾スラッシュも統一で剥がす
  return base.replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

export function getDjangoOrigin() {
  return toOrigin(process.env.DJANGO_API_BASE_URL ?? process.env.API_BASE, "http://127.0.0.1:8000");
}
