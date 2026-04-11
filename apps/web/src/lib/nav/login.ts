export function sanitizeNext(next: string | null | undefined): string | null {
  const t0 = (next ?? "").trim();
  if (!t0) return null;

  let t = t0;
  try {
    t = decodeURIComponent(t0);
  } catch {
    // ignore
  }

  if (!t.startsWith("/")) return null;
  if (t.startsWith("//")) return null;
  if (t.includes("://")) return null;

  if (t.startsWith("/auth/login")) return null;
  if (t.startsWith("/auth/register")) return null;
  if (t.startsWith("/login")) return null;
  if (t.startsWith("/signup")) return null;

  return t;
}

export function sanitizeReturnTo(returnTo: string | null | undefined): string | null {
  return sanitizeNext(returnTo);
}

export function buildLoginHref(returnTo?: string | null): string {
  const safe = sanitizeReturnTo(returnTo);
  return safe ? `/auth/login?returnTo=${encodeURIComponent(safe)}` : "/auth/login";
}

export function buildRegisterHref(returnTo?: string | null): string {
  const safe = sanitizeReturnTo(returnTo);
  return safe ? `/auth/register?returnTo=${encodeURIComponent(safe)}` : "/auth/register";
}

export function buildLoginHrefFromCurrent(pathname: string, search: string): string {
  const current = `${pathname}${search || ""}`;
  return buildLoginHref(current);
}

export function buildRegisterHrefFromCurrent(pathname: string, search: string): string {
  const current = `${pathname}${search || ""}`;
  return buildRegisterHref(current);
}
