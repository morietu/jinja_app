// apps/web/src/lib/nav/login.ts
export function sanitizeNext(next: string | null | undefined): string | null {
  const t0 = (next ?? "").trim();
  if (!t0) return null;

  // 1回だけ decode を試す（壊れてても落ちない）
  let t = t0;
  try {
    t = decodeURIComponent(t0);
  } catch {
    // ignore
  }

  // 内部パスだけ許可
  if (!t.startsWith("/")) return null;
  if (t.startsWith("//")) return null;
  if (t.includes("://")) return null;

  return t;
}

export function buildLoginHref(next?: string | null): string {
  const safe = sanitizeNext(next);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

export function buildLoginHrefFromCurrent(pathname: string, search: string): string {
  const current = `${pathname}${search || ""}`;
  return buildLoginHref(current);
}
